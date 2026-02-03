# PWA Icons Setup

To complete your PWA setup, you need to add icon files to this `static/` folder.

## Required Icons

You need to create these two icon files:

1. **icon-192.png** - 192x192px PNG
2. **icon-512.png** - 512x512px PNG

## How to Create Icons

### Option 1: Use an existing logo/image
- Take your app logo or brand image
- Resize it to 512x512px (use a tool like GIMP, Photoshop, or online tools)
- Save as `icon-512.png`
- Resize to 192x192px and save as `icon-192.png`

### Option 2: Quick placeholder with online tools
- Use https://realfavicongenerator.net/
- Or https://www.pwabuilder.com/imageGenerator
- Upload your logo and it will generate all sizes for you

### Option 3: Simple solid color (for testing)
You can create simple solid color squares using ImageMagick:

```bash
# Create a 512x512 black square with white text
convert -size 512x512 xc:#000000 \
  -fill white -font Arial -pointsize 200 -gravity center \
  -annotate +0+0 "VF" icon-512.png

# Create a 192x192 version
convert -size 192x192 xc:#000000 \
  -fill white -font Arial -pointsize 80 -gravity center \
  -annotate +0+0 "VF" icon-192.png
```

## Icon Guidelines

- **Square aspect ratio**: Icons should be perfect squares
- **Safe zone**: Keep important content in the center (outer 10% may be cropped)
- **No transparency**: Use solid backgrounds (though PNG transparency is technically supported)
- **Simple design**: Icons are shown small, so keep them simple and recognizable

## Testing Your PWA

After adding icons:

1. Build and run your app in production mode
2. Open in Chrome/Edge on mobile (or use DevTools device emulation)
3. Look for the "Install" prompt in the address bar
4. Install the PWA and check if the icon appears on your home screen
5. Open the app - you should see no browser UI (standalone mode)!

---

**Current Status**: ⚠️ Placeholder icons needed - add `icon-192.png` and `icon-512.png` to this folder
