"""Original modular city, authored through the inspected Blender MCP instance.

The factory Scene is preserved. Game coordinates are Y-up, facing +Z; B converts
them for Blender. All profile meshes contain applied positions and vertex colors.
Run definitions plus build_city(profile) in separate MCP calls.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi

BASE='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil'
OUT=BASE+'/assets/shibuya/v177'
FAMILIES=['Rounded','Glass','Shop','Terrace','Station','Arcade']
def B(p):return (p[0],-p[2],p[1])
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (1,3,5))
def enum_value(owner,key,wanted):
    values=[i.identifier for i in owner.bl_rna.properties[key].enum_items]
    if wanted not in values:raise ValueError((key,wanted,values))
    return wanted
def empty(name,col,parent=None):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.parent=parent;return o
def material(name,glow=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Roughness'].default_value=.9;p.inputs['Specular IOR Level'].default_value=.1
    a=m.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='Color'
    m.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
    if glow:
        m.node_tree.links.new(a.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.7
    return m
def collector():return {'v':[],'f':[],'c':[]}
def add(a,points,faces,color):
    n=len(a['v']);a['v'].extend(B(p) for p in points);a['f'].extend(tuple(n+i for i in f) for f in faces);a['c'].extend([rgb(color)]*len(points))
def box(a,x,y,z,w,h,d,color):
    p=[(x+i*w/2,y+j*h/2,z+k*d/2) for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    add(a,p,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color)
def round_box(a,x,y,z,w,h,d,r,color,steps=4):
    ring=[]
    for cx,cz,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,pi/2),(-w/2+r,-d/2+r,pi),(w/2-r,-d/2+r,pi*1.5)]:
        for j in range(steps+1):
            t=start+j*pi/2/steps;ring.append((x+cx+r*cos(t),z+cz+r*sin(t)))
    n=len(ring);p=[(px,y+dy,pz) for dy in [-h/2,h/2] for px,pz in ring]
    f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    add(a,p,f,color)
def mesh(name,a,mat,col,parent,batch):
    data=bpy.data.meshes.new(name);data.from_pydata(a['v'],[],a['f']);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
    params=data.color_attributes.bl_rna.functions['new'].parameters
    assert 'FLOAT_COLOR' in [i.identifier for i in params['type'].enum_items]
    assert 'POINT' in [i.identifier for i in params['domain'].enum_items]
    paint=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,c in enumerate(a['c']):paint.data[i].color=(*c,1)
    o=bpy.data.objects.new(name,data);col.objects.link(o);o.parent=parent;o.data.materials.append(mat);o['batch']=batch
    return o
def build_city(profile):
    s=bpy.data.scenes.get('Living_Shibuya') or bpy.data.scenes.new('Living_Shibuya');bpy.context.window.scene=s
    col=bpy.data.collections.new('Living_Shibuya_'+profile);s.collection.children.link(col)
    root=empty('ShibuyaKit_'+profile,col);root['schemaVersion']=1;root['familyCount']=6;root['front']='+Z';root['groundY']=0
    stone=material('City_Navy_'+profile);light=material('City_Windows_'+profile,True)
    steps=4 if profile=='desktop' else 2
    for family in FAMILIES:
        g=empty('City_'+family+'_'+profile,col,root);g['family']=family;g['baseSize']=[18,48,14]
        a=collector();e=collector();navy='#273c59';trim='#415777';ink='#14213a';warm='#edb470';cyan='#59cfdf';pink='#cf629d'
        # The street storey has depth, glazed entrances and a continuous canopy.
        round_box(a,0,3.8,0,18,7.6,14,.7,ink,steps)
        box(a,0,7.7,.2,19,.55,14.5,trim)
        for x in [-6,-2,2,6]:box(e,x,3.7,7.04,3.15,5.8,.08,warm if x!=2 else '#a3aecd')
        for x in [-8,-4,0,4,8]:box(a,x,3.7,7.15,.28,6.4,.38,navy)
        if family=='Rounded':
            round_box(a,0,26,0,18,36,14,4,navy,steps)
            for y in [11,16,21,26,31,36,41]:
                round_box(e,0,y,0,18.06,2.5,14.06,4.01,'#719fb3' if y%2 else '#ce939f',steps)
                round_box(a,0,y+1.5,0,18.25,.38,14.25,4,trim,steps)
            round_box(a,0,45,0,17,2,13,3.8,trim,steps)
            round_box(a,0,47.2,0,13,2.4,10,3,ink,steps)
            for x in [-4,4]:box(a,x,49,0,1,2,6,trim)
        elif family=='Glass':
            round_box(a,0,27,0,17,38,13,1.2,ink,steps)
            box(e,0,27,6.58,15.8,36,.12,'#527f9e')
            for x in [-7,-3.5,0,3.5,7]:box(a,x,27,6.7,.23,38,.25,trim)
            for y in range(10,46,4):box(a,0,y,6.7,16,.26,.25,navy)
            for x in [-8.6,8.6]:box(e,x,27,0,.1,36,11.4,'#375f80')
            box(a,1,47,0,14,2.2,11,trim);box(a,3,49,0,9,2,8,navy);box(a,4,52,0,.28,6,.28,trim)
        elif family=='Shop':
            box(a,0,25,-1,16,34,12,navy);box(a,0,43,-1,17,1.1,13,trim)
            for y in [12,18,24,30,36]:
                for x in [-5,0,5]:box(e,x,y,5.05,3.1,3.7,.12,warm if int(y+x)%3==0 else '#6a8dac')
                box(a,0,y-2.2,5.4,16,.38,1,trim)
            # Different-sized projecting signs have finished backs, not floating planes.
            for i,x in enumerate([-7,6.9]):
                box(a,x,26,6.8,2.7,26,1.8,ink)
                for j in range(4):box(e,x,17+j*6,7.76,2.25,4.7,.12,cyan if (i+j)%2 else pink)
            box(a,-3,46,-1,6,5,6,trim);box(a,4,45,0,3,3,5,ink)
        elif family=='Terrace':
            for i,(w,y,h,z,d) in enumerate([(18,16,17,0,14),(14,30,12,-1.3,11.4),(10,41,10,-2.5,9)]):
                box(a,0,y,z,w,h,d,navy)
                for x in [-w*.32,0,w*.32]:box(e,x,y,z+d/2+.04,w*.22,h*.62,.09,'#8aa3b8' if i else warm)
                box(a,0,y+h/2,z,w+1,.5,d+1,trim)
                # Open terrace rail, low planters and planted crowns on each setback.
                for x in [-w*.42,0,w*.42]:box(a,x,y+h/2+1,z+d/2,1.8,2,1.1,'#496e69')
                box(a,0,y+h/2+1.8,z+d/2,w,.18,.18,trim)
            box(a,0,47,-2.5,7,2,6,ink)
        elif family=='Station':
            # Low broad station. Family height is deliberately different from tower assets.
            a=collector();e=collector();g['baseSize']=[18,12,14]
            for x in [-8,8]:box(a,x,5,0,2,10,14,navy)
            box(a,0,10,0,18,2,14,navy);round_box(a,0,11.4,1,19,1,16,1.1,trim,steps)
            box(a,0,4,-5,14,8,.5,ink);box(e,0,8.5,7.1,14,1.8,.08,cyan)
            for x in [-6,0,6]:box(e,x,4,-4.68,2.5,4,.12,warm)
            for j in range(4):box(a,0,.15+j*.22,9-j*.6,15,.22,.7,trim)
        else:
            box(a,0,22,-1,18,28,12,navy)
            for y in [13,20,27,34]:
                box(e,0,y,5.07,15,3.8,.1,'#886d9e' if y%2 else '#6b88c0')
                box(a,0,y-2.2,5.3,18,.55,1,trim)
            box(a,0,6,7.3,19,2,2.4,ink);box(e,0,6,8.55,17,.45,.1,pink)
            for x in [-7.8,7.8]:box(a,x,4,7.3,.5,7,1,trim);box(e,x,4,7.9,.12,5.5,.1,cyan)
            round_box(a,0,38,-1,15,3,10,1.4,trim,steps);round_box(a,0,41,-1,9,3,8,1.4,ink,steps)
            box(a,0,46,-1,1,8,1,trim)
        mesh('City_'+family+'_Stone_'+profile,a,stone,col,g,'Stone')
        mesh('City_'+family+'_Windows_'+profile,e,light,col,g,'Windows')
    s['description']='Six original modular rainy-night Shibuya architectural families; Y up / +Z street front.'
    print(json.dumps({'profile':profile,'objects':len(col.objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')}))
    return col

def prop_ellipsoid(a,center,size,color,segs=12,rings=6):
    p=[(center[0]+size[0]*sin(pi*j/rings)*cos(2*pi*i/segs),center[1]+size[1]*cos(pi*j/rings),center[2]+size[2]*sin(pi*j/rings)*sin(2*pi*i/segs)) for j in range(1,rings) for i in range(segs)]
    p.extend([(center[0],center[1]+size[1],center[2]),(center[0],center[1]-size[1],center[2])]);top=len(p)-2;bottom=len(p)-1
    f=[(top,i,(i+1)%segs) for i in range(segs)]+[(bottom,(rings-2)*segs+(i+1)%segs,(rings-2)*segs+i) for i in range(segs)]
    for j in range(rings-2):
        for i in range(segs):f.append((j*segs+i,j*segs+(i+1)%segs,(j+1)*segs+(i+1)%segs,(j+1)*segs+i))
    add(a,p,f,color)
def build_city_props(profile):
    s=bpy.data.scenes['Living_Shibuya'];bpy.context.window.scene=s;col=bpy.data.collections['Living_Shibuya_'+profile];root=bpy.data.objects['ShibuyaKit_'+profile];mat=bpy.data.materials['City_Navy_'+profile]
    meeting=empty('City_Meeting_'+profile,col,root);a=collector()
    bronze='#73968b'
    prop_ellipsoid(a,(0,2.9,0),(.64,1.3,.70),bronze)
    prop_ellipsoid(a,(0,4.35,.04),(.60,.66,.53),bronze)
    prop_ellipsoid(a,(0,4.13,.48),(.39,.29,.49),bronze)
    for sign in [-1,1]:
        prop_ellipsoid(a,(sign*.47,4.95,.02),(.23,.52,.24),bronze)
        prop_ellipsoid(a,(sign*.40,2.35,.52),(.19,1.00,.23),bronze)
        prop_ellipsoid(a,(sign*.40,1.53,.73),(.24,.20,.46),bronze)
    dog=mesh('City_Guardian_Sculpt_'+profile,a,mat,col,meeting,'Stone')
    bpy.ops.object.select_all(action='DESELECT');dog.select_set(True);bpy.context.view_layer.objects.active=dog;dog.data.remesh_voxel_size=.12;bpy.ops.object.voxel_remesh()
    count=sum(len(p.vertices)-2 for p in dog.data.polygons);dec=dog.modifiers.new('Applied guardian optimization','DECIMATE');dec.ratio=(480 if profile=='desktop' else 240)/count;bpy.ops.object.modifier_apply(modifier=dec.name)
    merged=collector();merged['v'].extend(tuple(v.co) for v in dog.data.vertices);merged['f'].extend(tuple(p.vertices) for p in dog.data.polygons);merged['c'].extend([rgb(bronze)]*len(dog.data.vertices))
    bpy.data.objects.remove(dog,do_unlink=True)
    round_box(merged,0,.27,0,23,.54,17,.8,'#43536a',2);round_box(merged,0,.95,0,3.3,1.35,3,.4,'#596a75',2)
    for sign in [-1,1]:
        box(merged,sign*7,.8,0,5,.8,1.5,'#25384a');box(merged,sign*7,1.25,.1,5,.25,2,'#aa8468');box(merged,sign*7,2,-.68,5,.25,.2,'#aa8468')
    o=mesh('City_Meeting_Stone_'+profile,merged,mat,col,meeting,'Stone')
    furniture=empty('City_Furniture_'+profile,col,root);a=collector()
    round_box(a,0,1.2,0,2.7,2.4,2,.4,'#3c5865',3);round_box(a,0,2.5,0,2.9,.3,2.2,.4,'#728398',3)
    box(a,6,3.8,0,.35,7.6,.35,'#627992');round_box(a,6,7.2,0,3,1.5,.4,.3,'#a4c8cc',3)
    for x in [-6,-2]:box(a,x,1,0,.4,1.6,1.6,'#34445d')
    box(a,-4,1.4,0,5,.3,2,'#a18b77');box(a,-4,2.3,-.75,5,.8,.2,'#a18b77')
    mesh('City_Furniture_Stone_'+profile,a,mat,col,furniture,'Stone')
    print(profile,'props',sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meeting.children)+sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in furniture.children))
