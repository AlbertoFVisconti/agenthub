import struct

def create_placeholder_ico(filename):
    width = 256
    height = 256
    bpp = 32
    color = (255, 100, 100, 255) # BGRA usually?

    # create a simple single-color image
    image_data = b""
    for _ in range(width * height):
        image_data += struct.pack("BBBB", color[0], color[1], color[2], color[3]) 

    # BMP header for ICO (no file header, just info header + data)
    bmp_info_header = struct.pack("<IIIHHIIIIII",
        40, width, height * 2, 1, bpp, 0, len(image_data), 0, 0, 0, 0)
    
    and_mask = b"\x00" * ((width + 31) // 32 * 4 * height)
    
    bmp_data = bmp_info_header + image_data + and_mask

    # ICO header
    ico_header = struct.pack("<HHH", 0, 1, 1) # reserved, type(ico), count
    
    # ICO Dir Entry (for >=256 width/height, use 0)
    ico_dir = struct.pack("<BBBBHHII",
        0, 0, 0, 0, 1, bpp, len(bmp_data), 6 + 16) # offset = 22

    with open(filename, "wb") as f:
        f.write(ico_header)
        f.write(ico_dir)
        f.write(bmp_data)

create_placeholder_ico("electron/build/icon.ico")
