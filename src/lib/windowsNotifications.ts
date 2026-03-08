// Windows / Browser Notification API for chat messages

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones de escritorio");
    return Promise.resolve("denied" as NotificationPermission);
  }
  return Notification.requestPermission();
}

export function sendBrowserNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  const notification = new Notification(title, {
    body,
    icon: options?.icon || "/favicon.ico",
    tag: options?.tag, // prevents duplicate notifications with same tag
    badge: "/favicon.ico",
  });

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto-close after 6 seconds
  setTimeout(() => notification.close(), 6000);

  return notification;
}
