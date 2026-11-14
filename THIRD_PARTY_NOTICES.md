# Third-party notices

Hotmax Browser's original source is licensed under the [MIT License](LICENSE).
Third-party components retain their own licenses and copyright notices.

| Component | Role | License | Included notice |
| --- | --- | --- | --- |
| [Electron](https://github.com/electron/electron) | Desktop runtime | MIT | [Electron.txt](licenses/Electron.txt) |
| [Chromium](https://www.chromium.org/) and components bundled with Electron | Browser engine and runtime components | Multiple licenses | `LICENSES.chromium.html` in the Electron distribution and packaged application resources |
| [Electron Packager](https://github.com/electron/packager) | Development-only packaging tool | BSD-2-Clause | [Electron-Packager.txt](licenses/Electron-Packager.txt) |
| [Prettier](https://github.com/prettier/prettier) | Development-only formatter | MIT | [Prettier.txt](licenses/Prettier.txt) |

Dependency versions and transitive dependency metadata are recorded in package-lock.json.
Package manager downloads retain the upstream license files. Development dependencies are not bundled as application runtime dependencies.

The packaging script copies the Electron `LICENSE` and `LICENSES.chromium.html` supplied with the exact installed runtime into the application resources. Preserve these files when redistributing the application. This notice does not replace those complete license texts.
