"""Separate review candidate. Execute through Blender MCP, never the old exporter.
Artist-authored contour rings and swept lock controls are in game Y-up/+Z-front.
The existing sculpt, exports and original scene remain untouched.
"""
import bpy, bmesh, math, json
from math import sin, cos, pi, sqrt, exp
from mathutils import Vector
BASE = r'C:\Users\denze\Documents\Codex\2026-09-23\i-want-x20\outputs\anime-coil'
OUT = BASE + '/assets/kitsu/candidates/reference-rebuild'
# Reruns replace only this setup-owned review scene, never the existing master.
prior=bpy.data.scenes.get('Kitsu_Reference_Rebuild_Review')
if prior:
    bpy.context.window.scene=bpy.data.scenes['Kitsu_Reference_Studio_169']
    for c in list(prior.collection.children):
        for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(c)
    bpy.data.scenes.remove(prior)
scene = bpy.data.scenes.new('Kitsu_Reference_Rebuild_Review')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Kitsu_Reference_Rebuild')
scene.collection.children.link(collection)
studio = bpy.data.collections.new('Kitsu_Rebuild_Studio')
scene.collection.children.link(studio)
def B(p): return (p[0], -p[2], p[1])
def material(key, color, rough=.62, metal=0):
    m=bpy.data.materials.new('Rebuild_'+key); m.use_nodes=True
    m.diffuse_color=(*color,1)
    node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs[0].default_value=(*color,1)
    node.inputs[1].default_value=metal; node.inputs[2].default_value=rough
    node.inputs[14].default_value=.23
    return m
M={key:material(key,*args) for key,args in {
 'Skin':((1,.36,.20),.65), 'Hair':((1,.38,.015),.58),
 'Fabric':((.023,.027,.047),.82), 'Metal':((.49,.53,.64),.48,.32),
 'Details':((.105,.11,.15),.7), 'CheekMarks':((.78,.18,.095),.7),
 'Mouth':((.36,.073,.04),.8), 'EyeWhites':((.96,.89,.85),.58),
 'Pupils':((.018,.012,.024),.52), 'Highlights':((1,.98,.95),.5)
}.items()}
def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); collection.objects.link(o)
    o.parent=parent; o.location=B(pos); return o
root=empty('Kitsu_Rebuild_Head',(0,.12,0))
root['assetVersion']='1.6.9'; root['reviewStatus']='AWAITING_USER_VISUAL_APPROVAL'
root['attachment']='Unchanged origin and +0.12 sculpt mount; existing coil retained'
eyes=empty('Kitsu_Rebuild_EyesPivot',(0,1.28,0),root); eyes['previewEye']=True
def mesh(name,v,f,key,parent=None,smooth=True,weld=True):
    d=bpy.data.meshes.new(name); d.from_pydata([B(p) for p in v],[],f); d.update()
    bm=bmesh.new(); bm.from_mesh(d)
    if weld:bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(d); bm.free()
    o=bpy.data.objects.new(name,d); collection.objects.link(o); o.parent=parent or root
    if parent==eyes:o.location=B((0,-1.28,0))
    d.materials.append(M[key]); o['batch']=key
    for poly in d.polygons:poly.use_smooth=smooth
    if key in ('Hair','Fabric'):o['silhouette']=True
    return o
def ellipsoid(name,p,r,key,n=24,rows=12,parent=None):
    v=[]; f=[]
    for j in range(rows+1):
        t=pi*j/rows
        for i in range(n):
            a=2*pi*i/n;v.append((p[0]+r[0]*sin(t)*cos(a),p[1]+r[1]*cos(t),p[2]+r[2]*sin(t)*sin(a)))
    for j in range(rows):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    return mesh(name,v,f,key,parent)
# Rounded occiput, soft cheeks and tapered chin; no separate facial plate.
CONTOURS=[(.56,0,.02,-.02),(.62,.43,.46,-.44),(.73,.66,.61,-.60),
 (.91,.85,.74,-.75),(1.12,.96,.81,-.83),(1.34,.97,.80,-.87),
 (1.55,.94,.73,-.86),(1.75,.87,.60,-.78),(1.93,.72,.39,-.66),
 (2.08,.43,.13,-.43),(2.15,0,-.12,-.12)]
def contour(y):
    if y<=.62:
        t=sqrt(max(0,(y-.56)/.06));return (.43*t,.46*t,-.44*t)
    k=next((i for i in range(len(CONTOURS)-1) if CONTOURS[i][0]<=y<=CONTOURS[i+1][0]),len(CONTOURS)-2)
    p1=CONTOURS[k];p2=CONTOURS[k+1];p0=CONTOURS[max(0,k-1)];p3=CONTOURS[min(len(CONTOURS)-1,k+2)]
    t=max(0,min(1,(y-p1[0])/(p2[0]-p1[0])))
    return tuple(.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t*t+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t*t*t) for j in (1,2,3))
def face_depth(x,y):
    w,front,rear=contour(y)
    z=front*sqrt(max(0,1-(x/max(.001,w))**2))
    for s in (-1,1):z-=.018*exp(-((x-s*.36)/.235)**4-((y-1.36)/.255)**4)
    return z
v=[];f=[];N=64;R=36
for j in range(R+1):
    y=.56+(2.15-.56)*(1-cos(pi*j/R))/2;w,front,rear=contour(y)
    for i in range(N):
        a=2*pi*i/N;x=w*sin(a);z=(front if cos(a)>=0 else -rear)*cos(a)
        if cos(a)>0:z=face_depth(x,y)
        v.append((x,y,z))
for j in range(R):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
mesh('Rebuild_CohesiveSkull_Cheeks_Chin',v,f,'Skin')
# Eye surfaces follow the skull, a shallow embedded oval with a small convex lens.
def patch(name,c,r,key,offset,bulge,parent=None,n=32,rows=8):
    v=[(c[0],c[1],face_depth(*c)+offset+bulge)];f=[]
    for j in range(1,rows+1):
        rho=j/rows
        for i in range(n):
            a=2*pi*i/n;x=c[0]+r[0]*rho*cos(a);y=c[1]+r[1]*rho*sin(a)
            v.append((x,y,face_depth(x,y)+offset+bulge*(1-rho*rho)))
    for i in range(n):f.append((0,1+i,1+(i+1)%n))
    for j in range(rows-1):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    return mesh(name,v,f,key,parent)
def face_tube(name,pts,r,key,parent=None):
    v=[];f=[];n=8
    for j,(x,y) in enumerate(pts):
        delta=Vector((pts[min(j+1,len(pts)-1)][0]-pts[max(0,j-1)][0],pts[min(j+1,len(pts)-1)][1]-pts[max(0,j-1)][1],0)).normalized()
        u=Vector((-delta.y,delta.x,0))
        for i in range(n):
            a=2*pi*i/n;xx=x+u.x*r*cos(a);yy=y+u.y*r*cos(a)
            v.append((xx,yy,face_depth(xx,yy)+.008+r*sin(a)))
    for j in range(len(pts)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    f.extend([tuple(reversed(range(n))),tuple((len(pts)-1)*n+i for i in range(n))])
    return mesh(name,v,f,key,parent)
for s in (-1,1):
    x=s*.36;y=1.355
    patch('Rebuild_EyeWhite_'+str(s),(x,y),(.221,.238),'EyeWhites',.005,.026,eyes)
    patch('Rebuild_Pupil_'+str(s),(x,y-.018),(.139,.178),'Pupils',.035,.021,eyes,n=28)
    patch('Rebuild_Highlight_'+str(s),(x-.039,y+.070),(.039,.046),'Highlights',.057,.010,eyes,n=16,rows=4)
    # The upper lid is a soft continuation of skin, rather than a dark outline.
    face_tube('Rebuild_UpperLid_'+str(s),[(x+.222*cos(t),y+.238*sin(t)) for t in [pi*.13+pi*.74*j/18 for j in range(19)]],.012,'Skin')
    for j in range(2):
        cx=s*.715;cy=1.11-j*.10
        patch('Rebuild_FlushWhisker_'+str(s)+'_'+str(j),(cx,cy),(.086,.024),'CheekMarks',.005,.010,n=20,rows=4)
ellipsoid('Rebuild_SoftNose',(0,1.145,.805),(.092,.090,.082),'Skin',24,12)
face_tube('Rebuild_SubtleSmile',[(.12*cos(pi*j/18),.956-.030*sin(pi*j/18)) for j in range(19)],.010,'Mouth')
# Thin ears: subtly leaned ovals with a sculpted helix and recessed concha.
for s in (-1,1):
    def earpoint(dx,dy,z):return (s*.958+dx*cos(s*.50)+z*sin(s*.50),1.29+dy,-.095-dx*sin(s*.50)+z*cos(s*.50))
    n=32;v=[];f=[]
    rings=[(0,.022),(.30,.024),(.56,.042),(.77,.095),(.91,.092),(1,.025),(.82,-.062),(0,-.070)]
    for radius,z in rings:
        for i in range(n):
            a=2*pi*i/n;dx=.155*radius*cos(a)*(1+.10*sin(a));dy=.187*radius*sin(a)
            v.append(earpoint(dx,dy,z))
    for j in range(len(rings)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    mesh('Rebuild_ThinRecessedEar_'+str(s),v,f,'Skin')
# Scalp shell masks all lock roots, with a coherent cap and nape silhouette.
v=[];f=[];n=40
caprings=[(1.852,.823,.49,-.779),(1.94,.885,.59,-.858),(2.035,.92,.65,-.915),
          (2.16,.86,.59,-.86),(2.28,.68,.43,-.70),(2.38,.40,.16,-.42),(2.43,0,-.12,-.12)]
for y,w,front,rear in caprings:
    for i in range(n):
        a=2*pi*i/n;v.append((w*sin(a),y+.025*(1-cos(a)) if y<1.9 else y,(front if cos(a)>=0 else -rear)*cos(a)))
for j in range(len(caprings)-1):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
mesh('Rebuild_ContinuousHairCap',v,f,'Hair')
# Rear shell uses the skull contour, not a separate lumpy ball intersecting the cheeks.
v=[];f=[];n=32;rows=18
for j in range(rows+1):
    y=.81+(2.05-.81)*j/rows;w,front,rear=contour(y)
    for i in range(n+1):
        a=pi*.54+pi*.92*i/n
        edgey=y-.04*(1-j/rows)*cos(5*(a-pi))
        v.append(((w+.035)*sin(a),edgey,(abs(rear)+.04)*cos(a)))
for j in range(rows):
    for i in range(n):a=j*(n+1)+i;f.append((a,a+1,a+n+2,a+n+1))
mesh('Rebuild_FittedRearHairShell',v,f,'Hair')
# Each lock has its own four Bezier controls, width profile and ridge depth.
def lock(name,controls,widths,depths,normal,facets=False):
    pts=[Vector(p) for p in controls];v=[];f=[];n=8;steps=len(widths)
    normal=Vector(normal).normalized()
    for j in range(steps):
        t=j/(steps-1);p=(1-t)**3*pts[0]+3*(1-t)**2*t*pts[1]+3*(1-t)*t*t*pts[2]+t**3*pts[3]
        tangent=3*(1-t)**2*(pts[1]-pts[0])+6*(1-t)*t*(pts[2]-pts[1])+3*t*t*(pts[3]-pts[2]);tangent.normalize()
        u=tangent.cross(normal).normalized();w=u.cross(tangent).normalized()
        for i in range(n):
            a=2*pi*i/n
            # Convex ridge, shallow back: deliberate folded leaf rather than a cone.
            ridge=sin(a)*(1 if sin(a)>0 else .45)
            v.append(tuple(p+u*cos(a)*widths[j]+w*ridge*depths[j]))
    for j in range(steps-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    f.extend([tuple(reversed(range(n))),tuple((steps-1)*n+i for i in range(n))])
    o=mesh('Rebuild_Hair_'+name,v,f,'Hair',smooth=True)
    # Continuous weighted-looking normals; the eight-section ridge supplies facets.
    # Do not identify edges by old indices after welding the pointed tips.
    return o
for s in (-1,1):
    lock('TallTemple_'+str(s),[(s*.60,2.03,-.13),(s*.70,2.27,-.05),(s*.77,2.60,-.02),(s*.84,2.79,-.02)],(.20,.24,.18,.10,0),(.19,.24,.19,.09,0),(0,0,1))
    lock('FrontWing_'+str(s),[(s*.08,2.035,.62),(s*.24,2.11,.76),(s*.43,2.22,.76),(s*.62,2.40,.70)],(.12,.23,.21,.12,0),(.07,.125,.105,.055,0),(0,0,1))
    lock('DownwardTemple_'+str(s),[(s*.74,2.21,.41),(s*.85,2.15,.53),(s*.91,1.99,.55),(s*.85,1.84,.48)],(.20,.19,.13,.055,0),(.10,.115,.09,.04,0),(0,0,1))
    lock('OuterSweep_'+str(s),[(s*.70,2.08,.03),(s*.86,2.15,.04),(s*1.12,2.25,.025),(s*1.26,2.27,0)],(.12,.19,.145,.06,0),(.11,.15,.11,.045,0),(0,0,1))
    lock('LowerSide_'+str(s),[(s*.77,1.99,-.17),(s*.92,2.00,-.18),(s*1.10,1.92,-.20),(s*1.18,1.84,-.23)],(.11,.155,.125,.055,0),(.095,.125,.10,.04,0),(0,0,1))
    lock('BackSweep_'+str(s),[(s*.59,2.07,-.55),(s*.75,2.18,-.64),(s*1.05,2.35,-.57),(s*1.17,2.40,-.48)],(.15,.23,.18,.07,0),(.09,.14,.11,.045,0),(0,0,-1))
    lock('BackLower_'+str(s),[(s*.68,1.98,-.60),(s*.87,1.96,-.62),(s*1.09,1.97,-.58),(s*1.16,2.07,-.51)],(.12,.17,.12,.05,0),(.10,.14,.105,.04,0),(0,0,-1))
    lock('ProfileSweep_'+str(s),[(s*.62,2.12,-.19),(s*.73,2.23,-.46),(s*.80,2.35,-.79),(s*.79,2.49,-1.03)],(.14,.22,.17,.075,0),(.11,.15,.12,.045,0),(s,0,0))
    lock('ProfileLowerSweep_'+str(s),[(s*.77,2.00,-.24),(s*.83,2.05,-.46),(s*.86,2.15,-.73),(s*.81,2.24,-.97)],(.11,.165,.13,.055,0),(.09,.115,.09,.035,0),(s,0,0))
    lock('Sideburn_'+str(s),[(s*.82,1.74,.05),(s*.87,1.58,.11),(s*.90,1.45,.12),(s*.87,1.31,.14)],(.045,.062,.054,.03,0),(.03,.04,.035,.02,0),(s*.8,0,.6))
lock('CenterForelock',[(0,2.015,.66),(-.03,2.15,.76),(-.025,2.29,.75),(0,2.42,.66)],(.15,.14,.09,.035,0),(.07,.085,.060,.025,0),(0,0,1))
lock('CrownSweep',[(-.39,2.16,-.28),(-.12,2.34,-.18),(.18,2.57,-.16),(.37,2.72,-.25)],(.20,.27,.21,.085,0),(.13,.18,.14,.05,0),(0,0,1))
lock('CrossCrown',[(-.14,2.16,-.02),(.08,2.29,.02),(.38,2.42,-.015),(.65,2.55,-.11)],(.15,.21,.17,.06,0),(.10,.13,.09,.04,0),(0,0,1))
lock('RearPeak',[(.08,2.13,-.59),(-.04,2.30,-.67),(-.19,2.53,-.58),(-.26,2.68,-.45)],(.18,.22,.14,.06,0),(.10,.14,.10,.04,0),(0,0,-1))
for name,controls,widths,depths in [
 ('LeftRear',[(-.61,2.25,-.54),(-.69,2.14,-.91),(-.61,1.98,-1.015),(-.48,1.85,-1.02)],(.14,.21,.18,.065,0),(.075,.13,.095,.035,0)),
 ('CenterRear',[(-.18,2.29,-.56),(-.28,2.16,-.98),(-.04,1.99,-1.055),(.18,1.82,-1.035)],(.19,.26,.20,.085,0),(.09,.15,.115,.045,0)),
 ('RightRear',[(.24,2.27,-.54),(.30,2.14,-.95),(.51,1.97,-1.045),(.66,1.83,-.98)],(.16,.23,.17,.07,0),(.08,.14,.10,.04,0)),
 ('OuterRear',[(.64,2.20,-.50),(.75,2.12,-.83),(.84,2.01,-.91),(.91,1.91,-.83)],(.11,.16,.115,.045,0),(.065,.11,.075,.03,0))
]:lock(name,controls,widths,depths,(0,0,-1))
for j,(x,tipx,tipy) in enumerate([(-.66,-.68,.80),(-.40,-.44,.69),(0,.04,.72),(.40,.46,.70),(.66,.71,.81)]):
    def backdepth(x,y):
        w,front,rear=contour(y);return (rear-.04)*sqrt(max(.04,1-(x/(w+.035))**2))
    lock('Nape_'+str(j),[(x,1.48,backdepth(x,1.48)+.04),(x,1.25,backdepth(x,1.25)-.015),(tipx,1.00,backdepth(tipx,1.00)-.03),(tipx,tipy,backdepth(tipx,tipy)-.02)],(.20,.19,.115,.04,0),(.07,.10,.07,.025,0),(0,0,-1))
# Closed headband with gentle crown fit, rounded cloth edges, and restrained depth.
v=[];f=[];n=64
for j,(y,w,d) in enumerate([(1.65,.935,.696),(1.667,.951,.712),(1.834,.857,.516),(1.851,.838,.499),
                           (1.851,.813,.474),(1.65,.910,.671)]):
    for i in range(n):
        a=2*pi*i/n;z=d*cos(a)
        if cos(a)<0:z=(.865 if j in (0,1,5) else .78)*cos(a)
        v.append((w*sin(a),y+.025*(1-cos(a)),z-.012))
for j in range(6):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;k=(j+1)%6*n;f.append((a,b,k+(i+1)%n,k+i))
band=mesh('Rebuild_ThinConformingHeadband',v,f,'Fabric',weld=False)
band['ringSegments']=64;band['ringCount']=6
def plate(name,c,width,height,depth,key,angle=0):
    v=[];f=[];n=40
    for z,k in ((-depth/2,.92),(-depth/2+.012,1),(depth/2-.012,1),(depth/2,.92)):
        for i in range(n):
            a=2*pi*i/n;xx=width/2*math.copysign(abs(cos(a))**.30,cos(a))*k;yy=height/2*math.copysign(abs(sin(a))**.30,sin(a))*k
            x=xx*cos(angle)-yy*sin(angle);y=xx*sin(angle)+yy*cos(angle)
            v.append((c[0]+x,c[1]+y,c[2]+z-.14*x*x))
    for j in range(3):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    # Face is a convex fan, avoiding the old long skinny glTF ngon triangles.
    for ring in (0,3):
        center=len(v);v.append((c[0],c[1],c[2]+(-depth/2 if ring==0 else depth/2)))
        for i in range(n):f.append((center,ring*n+i,ring*n+(i+1)%n))
    return mesh(name,v,f,key)
plate('Rebuild_CurvedSilverPlate',(0,1.754,.637),.76,.231,.052,'Metal')
plate('Rebuild_DiagonalEmblem',(0,1.754,.671),.274,.062,.015,'Details',.60)
for x in (-.319,.319):
    for y in (1.685,1.822):ellipsoid('Rebuild_Rivet',(x,y,.662-.14*x*x),(.019,.019,.011),'Metal',12,6)
ellipsoid('Rebuild_RearKnot',(0,1.75,-.887),(.105,.115,.095),'Fabric',20,10)
for s in (-1,1):
    v=[];f=[]
    for j,(x,y,z,w) in enumerate([(s*.025,1.70,-.945,.045),(s*.105,1.45,-.99,.07),(s*.18,1.18,-1.04,.093),(s*.225,.90,-1.005,.105)]):
        for dx,dz in ((-w,-.014),(w,-.014),(w,.014),(-w,.014)):v.append((x+dx,y,z+dz))
    for j in range(3):
        for i in range(4):a=j*4+i;b=j*4+(i+1)%4;f.append((a,b,b+4,a+4))
    f.extend([(3,2,1,0),(12,13,14,15)]);mesh('Rebuild_FabricTie_'+str(s),v,f,'Fabric')
# Neutral bright studio; old scene and all its objects are still in the file.
scene.world=bpy.data.worlds.new('Rebuild_StudioWorld');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs[0].default_value=(.78,.80,.84,1);bg.inputs[1].default_value=.42
def aim(o,p):o.rotation_euler=(Vector(B(p))-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,5,5),430,4.5),('Fill',(4,2.5,4),260,4),('Rim',(-1,4,-4),420,3)]:
    d=bpy.data.lights.new('Rebuild_Studio_'+name,'AREA');d.energy=power;d.size=size
    o=bpy.data.objects.new(d.name,d);studio.objects.link(o);o.location=B(pos);aim(o,(0,1.6,0))
d=bpy.data.cameras.new('Rebuild_ReviewCamera');cam=bpy.data.objects.new(d.name,d);studio.objects.link(cam)
cam.location=B((0,1.75,7));aim(cam,(0,1.75,0));d.type='ORTHO';d.ortho_scale=3.15;scene.camera=cam
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform=bpy.data.scenes['Kitsu_Reference_Studio_169'].view_settings.view_transform
scene.view_settings.exposure=0
scene.render.filepath=OUT+'/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-head-reference-rebuild.blend')
print(json.dumps({'candidate':OUT,'meshes':len([o for o in collection.objects if o.type=='MESH']),'masterTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in collection.objects if o.type=='MESH'),'preservedScenes':[s.name for s in bpy.data.scenes]}))
