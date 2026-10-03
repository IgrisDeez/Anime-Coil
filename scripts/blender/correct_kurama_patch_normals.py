"""Orient open marking/eye islands toward the muzzle; closed volumes stay outward."""
import bpy, bmesh
from mathutils import Vector
scene=bpy.data.scenes['Kurama_Chibi_Review'];bpy.context.window.scene=scene
collections=[bpy.data.collections[n] for n in ['Kurama_Chibi_Review','Kurama_Export_desktop','Kurama_Export_mobile']]
for collection in collections:
    for obj in collection.objects:
        if obj.type!='MESH' or obj.get('part')=='Tail':continue
        bm=bmesh.new();bm.from_mesh(obj.data);visited=set()
        for face in bm.faces:
            if face in visited:continue
            island=[];stack=[face]
            while stack:
                f=stack.pop()
                if f in visited:continue
                visited.add(f);island.append(f)
                for edge in f.edges:
                    for neighbor in edge.link_faces:
                        if neighbor not in visited:stack.append(neighbor)
            if any(len(edge.link_faces)==1 for f in island for edge in f.edges):
                direction=Vector((0,0,0))
                for f in island:direction+=f.normal*f.calc_area()
                if direction.y>0:bmesh.ops.reverse_faces(bm,faces=island)
        bm.to_mesh(obj.data);bm.free();obj.data.update()
print('Open facial/marking patches point forward; closed body surfaces retained')
