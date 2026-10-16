# E2E oqimlar

Talab: API (`AUTH_DEV_LOGIN=true`) va web (`NEXT_PUBLIC_DEV_LOGIN=true`) ishlab turgan, yangi seed qilingan baza, Playwright.

```bash
ffmpeg -f lavfi -i testsrc2=s=540x960:d=5 -pix_fmt yuv420p e2e/test-reel.mp4
npm i -g playwright && node e2e/flows.js
```
