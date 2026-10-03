"""Gear 5 candidate: approved facial anatomy, flowed curls, laugh and closed Haki fist.
Run through Blender MCP only, preserving other scenes and previous candidates.
"""
import bpy, bmesh, math, json
from mathutils import Vector
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
def build_pomu(profile):
    s=bpy.data.scenes.get('Pomu_Gear5') or bpy.data.scenes.new('Pomu_Gear5');bpy.context.window.scene=s
    for o in s.objects:o.hide_render=True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=BASE+'/public/assets/heads/pomu/pomu-head-mobile.glb')
    imported=list(bpy.context.selected_objects);parts={o.get('batch'):o for o in imported if o.type=='MESH'}
    col=bpy.data.collections.new('Pomu_Gear5_'+profile);s.collection.children.link(col)
    root=empty('PomuUltimate_'+profile,col);root['schemaVersion']=1;root['duration']=5.6;root['killTime']=3.4
    head=empty('PomuGear5Head_'+profile,col,root);head['mountY']=.12;head['front']='+Z'
    mount=empty('PomuGear5Mount_'+profile,col,head,(0,.12,0))
    eyes=empty('PomuGear5Eyes_'+profile,col,mount,(0,1.28,0));eyes['blinkPivotY']=1.28
    mat=material('PomuGear5_Vertex_Toon_'+profile)
    skin=collector();source_mesh(skin,parts['Skin'],'#f8bc99');source_mesh(skin,parts['Blush'],'#ec9d8d')
    white=collector();source_mesh(white,parts['EyeWhites'],'#fff8ef');source_mesh(white,parts['Highlights'],'#ffffff')
    iris=collector();source_mesh(iris,parts['Iris'],'#cd6174')
    pupil=collector();source_mesh(pupil,parts['Pupils'],'#30293a')
    mesh('PomuGear5_Skin_'+profile,skin,mat,col,mount,'Skin')
    for batch,a in [('EyeWhites',white),('Iris',iris),('Pupils',pupil)]:mesh('PomuGear5_'+batch+'_'+profile,a,mat,col,eyes,batch)
    clouds=collector();ink=collector();detail=profile=='desktop';steps=12 if detail else 6;sides=6 if detail else 5
    # The scalp joins flowed, individually swept curls. Roots overlap only beneath
    # the closed scalp volume; exposed tips spiral rather than repeating cones.
    ellipsoid(clouds,(0,1.94,-.06),(.82,.53,.73),'#ececf7',20 if detail else 14,8 if detail else 6)
    for i,(cx,cy,cz,r,start,sweep) in enumerate([
      (-.56,2.15,.43,.30,2.8,5.0),(-.25,2.26,.59,.27,2.1,5.4),(.12,2.25,.61,.28,1.5,5.1),(.48,2.15,.45,.30,1.3,5.0),
      (-.75,1.91,.10,.27,2.4,5.2),(.75,1.91,.10,.27,.6,5.2),(-.43,2.37,.02,.29,2.9,5.4),(.12,2.43,-.04,.30,1.8,5.3),
      (.57,2.27,-.25,.30,.4,5.2),(-.56,2.22,-.37,.29,3.2,5.1),(-.22,1.88,-.69,.31,2.8,5.2),(.38,1.84,-.63,.29,.4,5.2),
      (-.76,1.63,-.27,.23,2.5,5.4),(.75,1.62,-.27,.23,.1,5.4)]):
        pts=[]
        for j in range(steps+1):
            t=j/steps;angle=start+sweep*t;radius=r*(1-.78*t)
            pts.append((cx+radius*cos(angle),cy+radius*sin(angle),cz+.06*sin(pi*t)+(.04 if cz>0 else -.04)*t))
        tube(clouds,pts,.12 if detail else .115,'#faf8ff',sides,True)
    # A soft scarf passes behind the cheeks, with two turned ends and finished curls.
    for sign in [-1,1]:
        pts=[(sign*(.58+.30*sin(pi*t)),.69+.45*t,.05-.37*sin(pi*t)) for t in [j/steps for j in range(steps+1)]]
        tube(clouds,pts,.145,'#faf8ff',sides)
        pts=[(sign*(.85+.19*cos(2*pi*t)),1.20+.18*sin(2*pi*t),-.21+.08*t) for t in [j/steps for j in range(steps+1)]]
        tube(clouds,pts,.105,'#f7f5ff',sides,True)
        # Spiral eyebrows retain friendly raised brow peaks.
        pts=[]
        for j in range(steps+1):
            t=j/steps;ang=-.5+2*pi*t;r=.072*(1-.68*t)
            pts.append((sign*(.37+.11*(1-t))+sign*r*cos(ang),1.57+r*sin(ang),.666+.022*sin(pi*t)))
        tube(ink,pts,.021,'#494354',5,True)
    # An intentionally broad smiling opening, small tooth ribbon and lower lip.
    mouth=[];teeth=[]
    for j in range(steps+1):
        q=-1+2*j/steps;x=.32*q;z=.767-.30*x*x
        top=1.017+.062*q*q;bottom=.855+.224*q*q
        mouth.extend([(x,top,z),(x,bottom,z)])
        teeth.extend([(x,top-.006,z+.007),(x,top-.045*(1-q*q)-.006,z+.010)])
    ribbon=[(j*2,j*2+1,j*2+3,j*2+2) for j in range(steps)]
    add(ink,mouth,ribbon,'#3a273c');add(clouds,teeth,ribbon,'#fffbef')
    for sign in [-1,1]:
        pts=[(sign*(.34+.065*t),.98+.07*t,.687-.04*t) for t in [j/4 for j in range(5)]]
        tube(ink,pts,.014,'#ad6460',5,True)
    # Luffy's small facial scar is still readable below the left eye.
    tube(ink,[(-.53,1.045,.61),(-.47,1.015,.663),(-.40,1.023,.703)],.012,'#a66863',5)
    for x in [-.485,-.442]:tube(ink,[(x,1.04,.659),(x-.005,.997,.667)],.008,'#a66863',4)
    hair=mesh('PomuGear5_Clouds_'+profile,clouds,mat,col,mount,'Clouds');hair['curlCount']=14;hair['silhouette']=True
    mesh('PomuGear5_Ink_'+profile,ink,mat,col,mount,'Ink')
    # A single closed hand volume: its sections grow from the wrist into the palm,
    # sweep around the folded thumb, and finish in four rounded knuckle ridges.
    fist=empty('PomuHakiFist_'+profile,col,root);fist['wristAnchor']=[0,0,-.82];fist['front']='+Z'
    a=collector();p=[];f=[];segments=32 if detail else 20
    sections=[(-.85,.30,.27),(-.72,.32,.29),(-.50,.37,.33),(-.26,.48,.39),(0,.52,.42),(.28,.51,.40),(.52,.49,.37),(.67,.46,.32)]
    for j,(z,w,h) in enumerate(sections):
        for k in range(segments):
            t=k/segments*2*pi;ct=cos(t);st=sin(t)
            x=w*math.copysign(abs(ct)**.56,ct);y=h*math.copysign(abs(st)**.66,st)
            thumb=.29*exp(-((z-.06)/.29)**2)*max(0,ct)**4
            x+=thumb;y-=thumb*.44
            knuckle=exp(-((z-.62)/.15)**2)*(.065+.065*cos((x+.35)*2*pi/.235))*max(0,st)**3
            p.append((x,y+knuckle,z))
    for j in range(len(sections)-1):
        for k in range(segments):f.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
    # Rounded front and wrist caps, without visible internal palm intersections.
    center=len(p);p.append((0,0,-.90))
    for k in range(segments):f.append((center,k,(k+1)%segments))
    previous=(len(sections)-1)*segments
    for radius in [.78,.5,.23]:
        offset=len(p)
        for k in range(segments):
            t=k/segments*2*pi;ct=cos(t);st=sin(t)
            x=.46*radius*math.copysign(abs(ct)**.56,ct);y=.32*radius*math.copysign(abs(st)**.66,st)
            z=.77+.068*cos((x+.35)*2*pi/.235)*(.65+.35*max(0,y/.32))
            p.append((x,y,z))
        for k in range(segments):f.append((previous+k,previous+(k+1)%segments,offset+(k+1)%segments,offset+k))
        previous=offset
    center=len(p);p.append((0,0,.77))
    for k in range(segments):f.append((center,previous+k,previous+(k+1)%segments))
    # Union the authored finger and thumb masses into one closed sculpt. This
    # finishes the transitions at the folded digits instead of leaving their
    # primitive intersection seams visible. The export contains no modifiers.
    a=collector()
    ellipsoid(a,(0,0,-.06),(.49,.36,.48),'#292638',24,12)
    ellipsoid(a,(0,-.01,-.59),(.31,.28,.35),'#292638',20,10)
    for x in [-.35,-.115,.115,.35]:
        ellipsoid(a,(x,.12,.44),(.143,.278,.215),'#292638',16,10)
        ellipsoid(a,(x,-.15,.37),(.14,.19,.235),'#292638',16,8)
    ellipsoid(a,(.48,-.11,.025),(.225,.26,.335),'#292638',20,10)
    o=mesh('PomuHaki_Hand_'+profile,a,mat,col,fist,'Hand');o['closedSurface']=True
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    o.data.remesh_voxel_size=.038 if detail else .055
    bpy.ops.object.voxel_remesh()
    count=sum(len(p.vertices)-2 for p in o.data.polygons)
    target=2200 if detail else 1300
    dec=o.modifiers.new('Applied sculpt optimization','DECIMATE');dec.ratio=min(1,target/count);bpy.ops.object.modifier_apply(modifier=dec.name)
    for p in o.data.polygons:p.use_smooth=True
    if 'Color' in o.data.color_attributes:o.data.color_attributes.remove(o.data.color_attributes['Color'])
    o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,v in enumerate(o.data.vertices):
        game=B((v.co.x,v.co.y,v.co.z))
        # B isn't self inverse; use explicit Blender -> game for light-facing ridges.
        gx,gy,gz=v.co.x,v.co.z,-v.co.y
        light=.5+.5*max(0,gy/.45);base=rgb('#292638');bright=rgb('#535268')
        o.data.color_attributes['Color'].data[i].color=tuple(base[c]+(bright[c]-base[c])*light*.50 for c in range(3))+(1,)
    crease=collector()
    for x in [-.35,-.115,.115,.35]:
        tube(crease,[(x-.06,.287,.602),(x,.312,.613),(x+.06,.288,.604)],.011,'#12131f',5)
        tube(crease,[(x-.05,-.14,.632),(x,-.16,.637),(x+.05,-.14,.632)],.008,'#963c56',5)
    tube(crease,[(.51,-.06,.44),(.62,-.16,.25),(.63,-.17,.06),(.55,-.11,-.07)],.013,'#14141f',5)
    mesh('PomuHaki_Seams_'+profile,crease,mat,col,fist,'Seams')
    # Remove only the GLB imported for this new candidate, never previous assets.
    for o in imported:bpy.data.objects.remove(o,do_unlink=True)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH' and o.parent!=fist)
    assert triangles+352<=(6000 if detail else 4000),(profile,triangles)
    s['description']='Original chibi Gear 5 form, approved Pomu anatomy, 14 flowed curls, laughing grin and coherent Haki fist.'
    print(json.dumps({'profile':profile,'headWithCoil':triangles+352,'headBatches':6,'fistTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in fist.children if o.type=='MESH')}))
    return col
