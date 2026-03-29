// Windows / Browser Notification API for chat messages

let notificationAudio: HTMLAudioElement | null = null;
let buzzAudio: HTMLAudioElement | null = null;

function getNotificationSound(): HTMLAudioElement {
  if (!notificationAudio) {
    notificationAudio = new Audio();
    // Short pleasant notification beep (base64-encoded WAV)
    notificationAudio.src = createNotificationBeep(660, 0.15);
    notificationAudio.volume = 0.5;
  }
  return notificationAudio;
}

function getBuzzSound(): HTMLAudioElement {
  if (!buzzAudio) {
    buzzAudio = new Audio();
    // More urgent double-beep for buzz
    buzzAudio.src = createNotificationBeep(880, 0.3, true);
    buzzAudio.volume = 0.7;
  }
  return buzzAudio;
}

/** Generate a simple beep tone as a data URI using Web Audio offline rendering */
function createNotificationBeep(freq: number, duration: number, doubleTone = false): string {
  // Use a tiny inline WAV since we can't rely on external files on intranet
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * duration);
  const totalSamples = doubleTone ? samples * 3 : samples; // gap between tones
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  for (let i = 0; i < totalSamples; i++) {
    let value = 0;
    const inFirstTone = i < samples;
    const inSecondTone = doubleTone && i >= samples * 2 && i < samples * 3;
    if (inFirstTone || inSecondTone) {
      const t = (inSecondTone ? i - samples * 2 : i) / sampleRate;
      const envelope = Math.min(1, Math.min(t * 20, (duration - t) * 20)); // fade in/out
      value = Math.sin(2 * Math.PI * freq * t) * 0.3 * envelope;
    }
    view.setInt16(44 + i * 2, value * 32767, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export function playNotificationSound(type: "message" | "buzz" = "message") {
  try {
    const audio = type === "buzz" ? getBuzzSound() : getNotificationSound();
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browser may block autoplay until user interaction — silent fail
    });
  } catch {
    // Silent fail
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined") {
    return "denied" as NotificationPermission;
  }
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones de escritorio");
    return "denied" as NotificationPermission;
  }

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function showNativeNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    onClick?: () => void;
    type?: "message" | "buzz";
  }
) {
  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon || "/logo-192.png",
      tag: options?.tag,
      badge: options?.icon || "/logo-192.png",
      silent: false,
      requireInteraction: options?.type === "buzz",
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    // Auto-close after 8s (buzz stays longer)
    const timeout = options?.type === "buzz" ? 12000 : 8000;
    setTimeout(() => notification.close(), timeout);

    return notification;
  } catch (err) {
    console.warn("Error showing notification:", err);
    return null;
  }
}

export function sendBrowserNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    onClick?: () => void;
    type?: "message" | "buzz";
  }
) {
  // Play sound regardless of notification permission
  playNotificationSound(options?.type || "message");

  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  if (Notification.permission === "granted") {
    return showNativeNotification(title, body, options);
  }

  if (Notification.permission === "default") {
    void requestNotificationPermission().then((permission) => {
      if (permission === "granted") {
        showNativeNotification(title, body, options);
      }
    });
  }

  return null;
}
