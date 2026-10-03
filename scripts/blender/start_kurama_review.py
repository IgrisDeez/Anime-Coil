"""Start only a task-owned localhost MCP connection in a fresh GUI instance."""
import bpy
import sys
sys.path.insert(0, 'C:/Users/denze/AppData/Roaming/Blender Foundation/Blender/5.2/scripts/addons')
import blender_mcp
if not hasattr(bpy.types.Scene, 'blendermcp_port'):
    blender_mcp.register()
bpy.context.scene.blendermcp_port = 9876
bpy.ops.blendermcp.start_server()
