interface ParsedDeviceInfo {
  name: string;
  deviceType: "mobile" | "desktop" | "tablet";
}

export const parseDeviceInfo = (ua: string): ParsedDeviceInfo => {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType: "mobile" | "desktop" | "tablet" = "desktop";

  // 1. Identify Operating System
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Macintosh")) os = "MacOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  // 2. Identify Browser (Order matters: Edge/Opera include 'Chrome' in UA)
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";

  // 3. Identify Device Type
  // Mobile devices typically include 'Mobi', while tablets include 'Tablet' or 'iPad'
  const isMobile = /Mobi|Android|iPhone|BlackBerry/i.test(ua);
  const isTablet = /Tablet|iPad|Playbook|Silk/i.test(ua);

  if (isTablet) {
    deviceType = "tablet";
  } else if (isMobile) {
    deviceType = "mobile";
  }

  return {
    name: `${browser} - ${os}`,
    deviceType: deviceType,
  };
};
