import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Orkest - Your personal task and time orchestration app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#000000",
            letterSpacing: "-0.02em",
          }}
        >
          Orkest
        </div>
        <div
          style={{
            fontSize: 36,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#555555",
            marginTop: 16,
          }}
        >
          Your personal task and time orchestration app
        </div>
      </div>
    ),
    { ...size },
  );
}
