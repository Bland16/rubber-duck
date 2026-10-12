"""The few Windows calls the duck needs. Windows only; imported by app.py and __main__.py."""
import ctypes
from ctypes import wintypes

SPI_GETWORKAREA = 48


def make_dpi_aware():
    """Asks Windows not to stretch the window, so art pixels stay sharp. Failure is fine."""
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass


def system_dpi():
    try:
        return int(ctypes.windll.user32.GetDpiForSystem()) or 96
    except Exception:
        return 96


def work_area():
    """(left, top, right, bottom) of the primary monitor without the taskbar, or None."""
    rect = wintypes.RECT()
    try:
        ok = ctypes.windll.user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(rect), 0)
    except Exception:
        return None
    return (rect.left, rect.top, rect.right, rect.bottom) if ok else None
