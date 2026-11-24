import { requireOptionalNativeModule } from "expo";

export type DluxBubbleNative = {
  canDraw(): boolean;
  openSettings(): void;
  show(): void;
  alert(title: string, subtitle: string, url: string | null, seconds: number): void;
  hide(): void;
};

/**
 * Burbuja flotante de Dlux (Android, ver android/src/main/java/expo/modules/dluxbubble).
 * null en Expo Go, en iPhone o en una compilación hecha antes de agregar el módulo.
 */
export default requireOptionalNativeModule<DluxBubbleNative>("DluxBubble");
