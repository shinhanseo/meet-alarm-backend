import { Router } from "express";
import axios from "axios";

const router = Router();

type RouteSummary = {
  totalTimeMin: number;
  totalTimeText: string;
  totalWalkTimeMin: number;
  totalWalkTimeText: string;
  totalFare: number;
  transferCount: number;
  totalDistanceM?: number;
  totalWalkDistanceM?: number;
  pathType?: number;
};

type SegmentBase = {
  type: string;
  timeMin: number;
  timeText: string;
  distanceM?: number;
  from?: string;
  to?: string;
};

type WalkSegment = SegmentBase & {
  type: "WALK";
};

type BusSegment = SegmentBase & {
  type: "BUS";
  route?: string;
  routeId?: string;
  color?: string;
  stops?: number;
};

type SubwaySegment = SegmentBase & {
  type: "SUBWAY";
  line?: string;
  routeId?: string;
  color?: string;
  stops?: number;
};

type Segment = WalkSegment | BusSegment | SubwaySegment | SegmentBase;

function secToMin(sec: unknown) {
  const n = Number(sec ?? 0);
  return Math.round(n / 60);
}

function formatMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0 && m === 0) return `${h}시간`;
  return `${m}분`;
}

function buildSegments(legs: any[]): Segment[] {
  return (legs ?? []).map((leg: any) => {
    const type = (leg.mode ?? "UNKNOWN") as string;
    const timeMin = secToMin(leg.sectionTime);
    const timeText = formatMinutes(timeMin);

    const distanceM = leg.distance ?? undefined;
    const from = leg.start?.name;
    const to = leg.end?.name;

    if (type === "WALK") {
      const seg: WalkSegment = {
        type: "WALK",
        timeMin,
        timeText,
        distanceM,
        from,
        to,
      };
      return seg;
    }

    if (type === "BUS") {
      const lane0 = leg.Lane?.[0];
      const route = leg.route ?? lane0?.route;
      const routeId = leg.routeId ?? lane0?.routeId;
      const color = leg.routeColor ?? lane0?.routeColor;
      const stops = leg.passStopList?.stationList?.length
        ? leg.passStopList.stationList.length - 1
        : undefined;

      const seg: BusSegment = {
        type: "BUS",
        timeMin,
        timeText,
        distanceM,
        from,
        to,
        route,
        routeId,
        color,
        stops,
      };
      return seg;
    }

    if (type === "SUBWAY") {
      const lane0 = leg.Lane?.[0];
      const line = leg.route ?? lane0?.route;
      const routeId = leg.routeId ?? lane0?.routeId;
      const color = leg.routeColor ?? lane0?.routeColor;
      const stops = leg.passStopList?.stationList?.length
        ? leg.passStopList.stationList.length - 1
        : undefined;

      const seg: SubwaySegment = {
        type: "SUBWAY",
        timeMin,
        timeText,
        distanceM,
        from,
        to,
        line,
        routeId,
        color,
        stops,
      };
      return seg;
    }

    // 기타 모드
    const seg: SegmentBase = {
      type,
      timeMin,
      timeText,
      distanceM,
      from,
      to,
    };
    return seg;
  });
}

function buildRouteDto(itinerary: any) {
  const totalTimeMin = secToMin(itinerary.totalTime);
  const totalWalkTimeMin = secToMin(itinerary.totalWalkTime);

  const summary: RouteSummary = {
    totalTimeMin,
    totalTimeText: formatMinutes(totalTimeMin), //"1시간 27분"
    totalWalkTimeMin,
    totalWalkTimeText: formatMinutes(totalWalkTimeMin),
    totalFare: itinerary.fare?.regular?.totalFare ?? 0,
    transferCount: itinerary.transferCount ?? 0,
    totalDistanceM: itinerary.totalDistance,
    totalWalkDistanceM: itinerary.totalWalkDistance,
    pathType: itinerary.pathType,
  };

  const segments = buildSegments(itinerary.legs);

  return { summary, segments };
}

router.post("/find", async (req, res) => {
  try {
    const { startX, startY, endX, endY } = req.body;
    
    if (!startX || !startY || !endX || !endY) {
      return res.status(400).json({
        message: "startX, startY, endX, endY 좌표가 필요합니다",
      });
    }

    const response = await axios.post(
      "https://apis.openapi.sk.com/transit/routes",
      {
        startX: Number(startX),
        startY: Number(startY),
        endX: Number(endX),
        endY: Number(endY),
        count: 3,
      },
      {
        headers: {
          appKey: process.env.TMAP_API_KEY!,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const itineraries = response.data?.metaData?.plan?.itineraries ?? [];

    if (!Array.isArray(itineraries) || itineraries.length === 0) {
      return res.status(404).json({ message: "경로를 찾을 수 없습니다" });
    }

    const routes = itineraries.map((it: any, idx: number) => ({
      index: idx,
      ...buildRouteDto(it),
    }));

    // 최단 시간순 정렬
    routes.sort((a, b) => a.summary.totalTimeMin - b.summary.totalTimeMin);
    
    return res.json({
      routesCount: routes.length,
      routes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "길찾기 API 호출 실패",
    });
  }
});

export default router;
