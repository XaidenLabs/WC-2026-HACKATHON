"use client";

import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CandlestickSeries,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from "lightweight-charts";

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export default function MatchChart({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#756d82",
        fontFamily: "monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(82,62,105,0.06)" },
        horzLines: { color: "rgba(82,62,105,0.06)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(82,62,105,0.12)" },
      rightPriceScale: { borderColor: "rgba(82,62,105,0.12)" },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#8059e8",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#8059e8",
      wickDownColor: "#f43f5e",
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}%` },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;
    seriesRef.current.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-full w-full" />;
}
