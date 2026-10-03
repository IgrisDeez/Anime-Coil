"""Bake selected profile meshes, preserve the editable master and old scene."""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kurama/candidates/chibi-review'
s=bpy.data.scenes['Kurama_Chibi_Review'];bpy.context.window.scene=s
source=bpy.data.collections['Kurama_Chibi_Review'];studio=bpy.data.collections['Kurama_Review_Studio']
def B(p):return (p[0],-p[2],p[1])
def lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgb(h):return tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5))
gold=rgb('#ffc94c');orange=rgb('#ef8a28');ink=rgb('#302431')
mat=bpy.data.materials.new('Kurama_Chakra_VertexColor');mat.use_nodes=True
nd=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');nd.inputs[0].default_value=(1,1,1,1);nd.inputs[2].default_value=.85;nd.inputs[14].default_value=.15
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='ChakraColor';mat.node_tree.links.new(vc.outputs[0],nd.inputs[0])
def taildata(name,rows,sides):
    v=[];faces=[];colors=[]
    for j in range(rows+1):
        t=j/rows;r=(.09+.32*sin(pi*t**.75))*(1-t)**.42+.003;cx=.23*sin(t*pi*1.8);cy=.16*sin(t*pi)+.34*t*t
        q=max(0,min(1,(t-.26)/.72));q=q*q*(3-2*q)
        for i in range(sides):
            a=2*pi*i/sides;v.append(B((cx+cos(a)*r,cy+sin(a)*r*.72,t*2.5)))
            stripe=sides*.64<=i<=sides*.80 and .065<t<.93
            colors.extend((*ink,1) if stripe else (*tuple(gold[k]*(1-q)+orange[k]*q for k in range(3)),1))
    for j in range(rows):
        for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(rows*sides+i for i in range(sides))])
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],faces);d.update()
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=True
    attr=d.color_attributes.new(name='ChakraColor',type='FLOAT_COLOR',domain='POINT');attr.data.foreach_set('color',colors);d.color_attributes.active_color=attr;d.materials.append(mat)
    return d
# Upgrade linked master tails to a smooth orange accent rather than a hard paint boundary.
prototype=bpy.data.objects['Kurama_Flame_Tail_Prototype'];mastertail=taildata('Kurama_Master_Gradient_Flame',22,14);prototype.data=mastertail
for o in bpy.data.collections['Kurama_Nine_Linked_Tails'].objects:o.data=mastertail
s.eevee.taa_render_samples=128;s.eevee.shadow_ray_count=4
stats={}
for profile,budgets,tailsteps in [('desktop',{'Body':2900,'Head':3200,'LeftPaw':1250,'RightPaw':1250},(20,12)),('mobile',{'Body':1950,'Head':2100,'LeftPaw':950,'RightPaw':950},(14,10))]:
    c=bpy.data.collections.new('Kurama_Export_'+profile);s.collection.children.link(c)
    asset=bpy.data.objects.new('KuramaAsset_'+profile,None);c.objects.link(asset);asset['schemaVersion']=1;asset['candidate']=True;asset['tailCount']=9;asset['tailFanVersion']=1
    beast=bpy.data.objects.new('fox-summon',None);c.objects.link(beast);beast.parent=asset
    parents={'Body':beast}
    for part,srcname,newname in [('Head','Kurama_HeadPivot','fox-head'),('LeftPaw','Kurama_LeftPawPivot','fox-left-paw'),('RightPaw','Kurama_RightPawPivot','fox-right-paw')]:
        src=bpy.data.objects[srcname];p=bpy.data.objects.new(newname,None);c.objects.link(p);p.parent=beast;p.location=src.location.copy();parents[part]=p
    anchor=bpy.data.objects.new('fox-muzzle-anchor',None);c.objects.link(anchor);anchor.parent=parents['Head']
    src=bpy.data.objects['Kurama_Muzzle'];srchead=bpy.data.objects['Kurama_HeadPivot'];anchor.location=src.location*srchead.scale
    bodytri=0
    for part,limit in budgets.items():
        verts=[];faces=[];colors=[]
        parent=parents[part];offset=Vector(parent.location) if parent!=beast else Vector((0,0,0))
        for src in source.objects:
            if src.type!='MESH' or src.get('part')!=part:continue
            start=len(verts);verts.extend([tuple(src.matrix_world@v.co-offset) for v in src.data.vertices])
            for poly in src.data.polygons:
                faces.append(tuple(start+i for i in poly.vertices))
                color=src.data.materials[poly.material_index].diffuse_color
                colors.extend(list(color)*len(poly.vertices))
        d=bpy.data.meshes.new('Kurama_'+part+'_'+profile);d.from_pydata(verts,[],faces);d.update()
        attr=d.color_attributes.new(name='ChakraColor',type='FLOAT_COLOR',domain='CORNER');attr.data.foreach_set('color',colors);d.color_attributes.active_color=attr
        d.materials.append(mat);o=bpy.data.objects.new('Kurama_'+part+'_'+profile,d);c.objects.link(o);o.parent=parent;o['batch']=part;o['sharedAssetGeometry']=True
        for p in d.polygons:p.use_smooth=True
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        tri=sum(len(p.vertices)-2 for p in d.polygons)
        if tri>limit:
            mod=o.modifiers.new('Profile reduction','DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=max(.001,(limit-20)/tri);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Applied triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
        d=o.data;bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();d.update()
        bodytri+=len(d.polygons)
    tail=bpy.data.objects.new('Kurama_TailPrototype_'+profile,taildata('Kurama_Tail_'+profile,*tailsteps));c.objects.link(tail);tail.parent=asset;tail['batch']='Tail';tail['sharedAssetGeometry']=True
    tailtri=sum(len(p.vertices)-2 for p in tail.data.polygons)
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.objects:o.select_set(True)
    # GLB is the export operator default for a .glb path in this installed version.
    bpy.ops.export_scene.gltf(filepath=OUT+'/kurama-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
    stats[profile]={'bodyTriangles':bodytri,'tailPrototypeTriangles':tailtri,'tailsAndContoursTriangles':tailtri*18,'totalModelTriangles':bodytri+tailtri*18,'bodyDraws':4,'tailDraws':2}
    c.hide_render=True;c.hide_viewport=True
cam=s.camera;cam.data.ortho_scale=36
for view,loc in [('front',(0,14,65)),('three-quarter',(52,24,52)),('side',(65,17,0)),('back',(0,14,-65))]:
    cam.location=B(loc);cam.rotation_euler=(Vector(B((0,14,0)))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=OUT+'/renders/'+view+'.png';bpy.ops.render.render(write_still=True)
cam.location=B((52,24,52));cam.rotation_euler=(Vector(B((0,14,0)))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kurama-chibi-master.blend')
print(json.dumps(stats))
