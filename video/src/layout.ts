import { useVideoConfig } from "remotion";

export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const square = width === height;
  return { width, height, square, cx: width / 2, cy: height / 2 };
};
