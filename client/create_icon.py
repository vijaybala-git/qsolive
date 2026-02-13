from PIL import Image, ImageDraw, ImageFont
import sys

def create_icon():
    print("Generating icon.ico...")
    
    # Create a 256x256 image with transparent background
    size = (256, 256)
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a blue circle background
    # Color: #0078D7 (Windows Blue)
    draw.ellipse((10, 10, 246, 246), fill='#0078D7')
    
    # Configure Font
    try:
        # Try to load Arial Italic (Standard on Windows)
        font = ImageFont.truetype("ariali.ttf", 180)
    except IOError:
        # Fallback if font not found
        print("Arial Italic not found, using default font.")
        font = ImageFont.load_default()

    # Draw the "Q"
    text = "Q"
    
    # Calculate text position to center it
    # textbbox is available in Pillow >= 9.2.0
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size[0] - text_width) / 2
    y = (size[1] - text_height) / 2 - 20 # Shift up slightly for visual balance

    # Draw text in white
    draw.text((x, y), text, font=font, fill='white')

    # Save as .ico containing multiple sizes
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save('icon.ico', format='ICO', sizes=icon_sizes)
    print("Success! Created icon.ico")

if __name__ == "__main__":
    create_icon()