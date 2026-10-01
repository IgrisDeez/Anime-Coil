import bpy, sys
sys.path.insert(0, r'C:\Users\denze\AppData\Roaming\Blender Foundation\Blender\5.2\scripts\addons')
import blender_mcp
if not hasattr(bpy.types.Scene, 'blendermcp_port'):
    blender_mcp.register()
bpy.context.scene.blendermcp_port = 9876
bpy.ops.blendermcp.start_server()
