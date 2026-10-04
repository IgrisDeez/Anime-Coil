"""Gear 5 candidate: approved facial anatomy, flowed curls, laugh and closed Haki fist.
Run through Blender MCP only, preserving other scenes and previous candidates.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from math import sin, cos, pi, exp
BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT=BASE+'/assets/pomu-gear5/v177'
def B(p):return (p[0],-p[2],p[1])
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (1,3,5))
def enum_value(owner,key,wanted):
    values=[i.identifier for i in owner.bl_rna.properties[key].enum_items]
    if wanted not in values:raise ValueError((key,wanted,values))
    return wanted
def empty(name,col,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.parent=parent;o.location=B(loc);return o
def collector():return {'v':[],'f':[],'c':[]}
def add(a,points,faces,color):
    n=len(a['v']);a['v'].extend(B(p) for p in points);a['f'].extend(tuple(n+i for i in f) for f in faces);a['c'].extend([rgb(color)]*len(points))
def tube(a,points,radius,color,sides=6,taper=False):
    n=len(points);p=[]
    for i,point in enumerate(points):
        tangent=(Vector(points[min(n-1,i+1)])-Vector(points[max(0,i-1)])).normalized()
        axis=Vector((0,0,1)) if abs(tangent.z)<.92 else Vector((0,1,0))
        u=tangent.cross(axis).normalized();v=tangent.cross(u).normalized()
        r=radius*(.22+.78*sin(pi*(.08+.84*i/(n-1)))**.6) if taper else radius
        for k in range(sides):p.append(Vector(point)+r*(u*cos(2*pi*k/sides)+v*sin(2*pi*k/sides)))
    f=[tuple(reversed(range(sides))),tuple(range((n-1)*sides,n*sides))]
    for i in range(n-1):
        for k in range(sides):f.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
    add(a,p,f,color)
def ellipsoid(a,center,size,color,segs=16,rings=8):
    p=[(center[0]+size[0]*sin(pi*j/rings)*cos(2*pi*i/segs),center[1]+size[1]*cos(pi*j/rings),center[2]+size[2]*sin(pi*j/rings)*sin(2*pi*i/segs)) for j in range(1,rings) for i in range(segs)]
    p.extend([(center[0],center[1]+size[1],center[2]),(center[0],center[1]-size[1],center[2])]);top=len(p)-2;bottom=len(p)-1
    f=[(top,i,(i+1)%segs) for i in range(segs)]+[(bottom,(rings-2)*segs+(i+1)%segs,(rings-2)*segs+i) for i in range(segs)]
    for j in range(rings-2):
        for i in range(segs):f.append((j*segs+i,j*segs+(i+1)%segs,(j+1)*segs+(i+1)%segs,(j+1)*segs+i))
    add(a,p,f,color)
def material(name):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.91;p.inputs['Specular IOR Level'].default_value=.10
    attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';m.node_tree.links.new(attr.outputs['Color'],p.inputs['Base Color']);return m
def mesh(name,a,mat,col,parent,batch,smooth=True):
    data=bpy.data.meshes.new(name);data.from_pydata(a['v'],[],a['f']);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
    params=data.color_attributes.bl_rna.functions['new'].parameters
    assert 'FLOAT_COLOR' in [i.identifier for i in params['type'].enum_items] and 'POINT' in [i.identifier for i in params['domain'].enum_items]
    paint=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,c in enumerate(a['c']):paint.data[i].color=(*c,1)
    for p in data.polygons:p.use_smooth=smooth
    o=bpy.data.objects.new(name,data);col.objects.link(o);o.parent=parent;o.data.materials.append(mat);o['batch']=batch;return o
def source_mesh(a,o,color):
    n=len(a['v']);a['v'].extend(tuple(v.co) for v in o.data.vertices);a['f'].extend(tuple(n+i for i in p.vertices) for p in o.data.polygons);a['c'].extend([rgb(color)]*len(o.data.vertices))

def super_box(a,center,size,color,segs=20,rings=12):
    p=[];f=[]
    def shape(v):return math.copysign(abs(v)**.36,v)
    for j in range(1,rings):
        phi=pi*j/rings
        for i in range(segs):
            t=2*pi*i/segs;p.append((center[0]+size[0]*shape(sin(phi))*shape(cos(t)),center[1]+size[1]*shape(cos(phi)),center[2]+size[2]*shape(sin(phi))*shape(sin(t))))
    p.extend([(center[0],center[1]+size[1],center[2]),(center[0],center[1]-size[1],center[2])]);top=len(p)-2;bottom=len(p)-1
    for i in range(segs):f.extend([(top,i,(i+1)%segs),(bottom,(rings-2)*segs+(i+1)%segs,(rings-2)*segs+i)])
    for j in range(rings-2):
        for i in range(segs):f.append((j*segs+i,j*segs+(i+1)%segs,(j+1)*segs+(i+1)%segs,(j+1)*segs+i))
    add(a,p,f,color)
def build_haki_fist(profile):
    s=bpy.data.scenes.get('Pomu_Haki_V178') or bpy.data.scenes.new('Pomu_Haki_V178');bpy.context.window.scene=s
    legacy=bpy.data.collections.new('Preserved_Pomu_V177_'+profile);s.collection.children.link(legacy)
    bpy.ops.import_scene.gltf(filepath=BASE+'/assets/pomu-gear5/v177/pomu-ultimate-'+profile+'.glb')
    originals={o.name:o for o in bpy.context.selected_objects}
    for o in list(bpy.context.selected_objects):
        o.name='V177_'+o.name
        for c in list(o.users_collection):c.objects.unlink(o)
        legacy.objects.link(o);o.hide_render=True
    legacy.hide_render=True;legacy.hide_viewport=True
    col=bpy.data.collections.new('Pomu_Haki_'+profile);s.collection.children.link(col)
    root=empty('PomuUltimate_'+profile,col);root['schemaVersion']=2;root['duration']=5.6;root['killTime']=3.4
    def clone_head(original,parent):
        copy=original.copy();copy.name=original.name.removeprefix('V177_');copy.parent=parent;copy.hide_render=False;col.objects.link(copy)
        for child in original.children:clone_head(child,copy)
        return copy
    clone_head(originals['PomuGear5Head_'+profile],root)
    fist=empty('PomuHakiFist_'+profile,col,root);fist['front']='+Z';fist['strikeAxis']=[0,0,1]
    mat=material('Pomu_Haki_Toon_'+profile);a=collector()
    super_box(a,(0,-.015,-.02),(.44,.32,.44),'#261a22',24,14)
    ellipsoid(a,(0,-.015,-.57),(.285,.255,.34),'#261a22',20,10)
    for i,x in enumerate([-.34,-.113,.113,.34]):
        super_box(a,(x,.12,.49),(.115,.23,.16),'#261a22',18,10)
        super_box(a,(x,-.17,.39),(.118,.17,.205),'#261a22',18,10)
    # A folded, swept thumb across the lower fingers, not a ball stuck to the palm.
    for center,size in [((.42,-.11,.035),(.17,.18,.22)),((.47,-.245,.21),(.14,.16,.22)),((.34,-.295,.38),(.23,.105,.17))]:
        ellipsoid(a,center,size,'#261a22',18,10)
    hand=mesh('PomuHaki_Hand_'+profile,a,mat,col,fist,'Hand')
    bpy.ops.object.select_all(action='DESELECT');hand.select_set(True);bpy.context.view_layer.objects.active=hand
    hand.data.remesh_voxel_size=.023 if profile=='desktop' else .036;bpy.ops.object.voxel_remesh()
    count=sum(len(p.vertices)-2 for p in hand.data.polygons);dec=hand.modifiers.new('Applied hand topology','DECIMATE');dec.ratio=(2350 if profile=='desktop' else 1370)/count;bpy.ops.object.modifier_apply(modifier=dec.name)
    bm=bmesh.new();bm.from_mesh(hand.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(hand.data);bm.free()
    for p in hand.data.polygons:p.use_smooth=True
    for attr in list(hand.data.color_attributes):hand.data.color_attributes.remove(attr)
    paint=hand.data.color_attributes.new(name='Color',type=enum_value(hand.data.color_attributes.bl_rna.functions['new'].parameters['type'],'identifier','FLOAT_COLOR') if False else 'FLOAT_COLOR',domain='POINT')
    base=rgb('#261a22');bright=rgb('#57434d')
    for i,v in enumerate(hand.data.vertices):
        gx,gy,gz=v.co.x,v.co.z,-v.co.y;shade=.10+.28*max(0,gy/.38)+.14*max(0,gz/.67)
        paint.data[i].color=tuple(base[j]+(bright[j]-base[j])*shade for j in range(3))+(1,)
    seam=collector()
    for x in [-.226,0,.226]:tube(seam,[(x,-.18,.615),(x,-.07,.66),(x,.1,.668),(x,.24,.652)],.007,'#130d13',5)
    for x in [-.34,-.113,.113,.34]:tube(seam,[(x-.055,.322,.62),(x,.341,.638),(x+.055,.325,.625)],.009,'#b92d46',5)
    tube(seam,[(.56,-.12,.03),(.586,-.22,.2),(.5,-.32,.35),(.34,-.36,.47)],.010,'#bd3049',5)
    seams=mesh('PomuHaki_Seams_'+profile,seam,mat,col,fist,'Seams')
    tree=BVHTree.FromPolygons([v.co for v in hand.data.vertices],[list(p.vertices) for p in hand.data.polygons])
    for v in seams.data.vertices:
        hit=tree.ray_cast(Vector((v.co.x,-2,v.co.z)),Vector((0,1,0)),4)[0]
        if hit is not None:v.co.y=hit.y-.0015
    bm=bmesh.new();bm.from_mesh(seams.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(seams.data);bm.free();seams.data.update()
    contact_z=max(-v.co.y for v in hand.data.vertices)
    fist['wristAnchor']=[0,-.015,-.82];fist['knuckleContact']=[0,.12,contact_z];fist['localBounds']=[[min(v.co.x for v in hand.data.vertices),min(v.co.z for v in hand.data.vertices),min(-v.co.y for v in hand.data.vertices)],[max(v.co.x for v in hand.data.vertices),max(v.co.z for v in hand.data.vertices),contact_z]]
    empty('PomuFistWrist_'+profile,col,fist,(0,-.015,-.82));empty('PomuFistContact_'+profile,col,fist,(0,.12,contact_z));axis=empty('PomuFistStrikeAxis_'+profile,col,fist);axis['axis']=[0,0,1]
    print(json.dumps({'profile':profile,'fistTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in fist.children if o.type=='MESH'),'contactZ':contact_z}))
def export_haki():
    s=bpy.data.scenes['Pomu_Haki_V178'];bpy.context.window.scene=s;stats=[]
    for profile in ['desktop','mobile']:
        col=bpy.data.collections['Pomu_Haki_'+profile];col.hide_viewport=False;col.hide_render=False;bpy.ops.object.select_all(action='DESELECT')
        for o in col.objects:o.hide_set(False);o.select_set(True)
        props=bpy.ops.export_scene.gltf.get_rna_type().properties
        for key,val in [('export_vertex_color','ACTIVE'),('export_image_format','AUTO')]:assert val in [i.identifier for i in props[key].enum_items]
        bpy.ops.export_scene.gltf(filepath=BASE+'/assets/pomu-gear5/v178/pomu-ultimate-'+profile+'.glb',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_image_format='AUTO')
        stats.append({'profile':profile,'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')})
    bpy.ops.wm.save_as_mainfile(filepath=BASE+'/assets/pomu-gear5/v178/pomu-haki-editable.blend');print(json.dumps(stats))
