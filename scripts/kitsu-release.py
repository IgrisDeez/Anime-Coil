"""Release entry point for the corrected local 1.6.9 assets."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('kitsu-correction-release.py')),run_name='__main__')
