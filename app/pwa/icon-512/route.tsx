import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0d8f7a 0%, #23b99e 100%)",
          color: "white",
          fontSize: 190,
          fontWeight: 700,
          borderRadius: 96,
        }}
      >
        SP
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}
