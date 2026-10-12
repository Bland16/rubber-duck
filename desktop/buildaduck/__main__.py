"""Entry point: checks the machine, picks the first duck, and reports a crash.

Run from source:   py -m buildaduck [file.duck.json]      (in desktop/)
Run the build:     py build-a-duck.pyzw [file.duck.json]
"""
import os
import sys
import tempfile
import traceback

TITLE = "Build-a-Duck"
ONLY_WINDOWS = "The desktop duck runs on Windows only."
OLD_PYTHON = "The desktop duck needs Python 3.9 or newer."


def tell(text):
    """A message box if one can be opened, else standard error if there is one."""
    try:
        import tkinter
        from tkinter import messagebox
        root = tkinter.Tk()
        root.withdraw()
        messagebox.showinfo(TITLE, text, parent=root)
        root.destroy()
    except Exception:
        if sys.stderr is not None:
            print(text, file=sys.stderr)


def report_crash(exc_type, exc, trace):
    """A double-clicked .pyzw has no console: write the error to a file and show it once."""
    text = "".join(traceback.format_exception(exc_type, exc, trace))
    path = os.path.join(tempfile.gettempdir(), "buildaduck-error.txt")
    try:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
    except OSError:
        pass
    last = text.strip().splitlines()[-1] if text.strip() else "Unknown error"
    tell(f"The duck ran into a problem and has to close.\n\n{last}\n\nDetails: {path}")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if sys.platform != "win32":
        tell(ONLY_WINDOWS)
        sys.exit(1)
    if sys.version_info < (3, 9):
        tell(OLD_PYTHON)
        sys.exit(1)
    try:
        if argv == ["--selftest"]:
            from .selftest import run_selftest
            sys.exit(run_selftest())
        run(argv)
    except SystemExit:
        raise
    except BaseException:
        report_crash(*sys.exc_info())
        sys.exit(1)


def run(argv):
    from . import config, win
    from .app import DuckApp
    from .loader import MESSAGES, load_duck_file, read_json
    from .startup import choose_duck

    win.make_dpi_aware()
    folder = config.default_folder()
    settings = config.load_config(folder)
    args = [os.path.abspath(argv[0])] if argv else []
    duck, source, error_key = choose_duck(args, settings, load_duck_file, read_json("classic.duck.json"))
    if error_key:
        tell(MESSAGES[error_key])
    if source == "argument":
        settings["duckPath"] = args[0]
        config.save_config(folder, settings)

    app = DuckApp(duck, read_json("responses.json"), settings, folder)

    def crashed(exc_type, exc, trace):
        # An error inside a tkinter callback lands here, not in main()'s handler.
        app.closed = True
        try:
            app.root.destroy()
        except Exception:
            pass
        report_crash(exc_type, exc, trace)
        os._exit(1)

    app.root.report_callback_exception = crashed
    app.run()


if __name__ == "__main__":
    main()
