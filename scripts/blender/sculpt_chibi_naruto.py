"""Balanced chibi Naruto candidate, authored and inspected through Blender MCP.
Only this review scene is replaced on rerun. Previous candidates are preserved.
Authoring coordinates are game Y-up, +Z forward; B converts them to Blender.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi, sqrt, exp
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/chibi-naruto'
old=bpy.data.scenes.get('Kitsu_Chibi_Naruto_Review')
if old:
    bpy.context.window.scene=bpy.data.scenes['Kitsu_AnimeReference_Review']
    for collection in list(old.collection.children):
        for obj in list(collection.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(collection)
    bpy.data.scenes.remove(old)
s=bpy.data.scenes.new('Kitsu_Chibi_Naruto_Review');bpy.context.window.scene=s
col=bpy.data.collections.new('Kitsu_Chibi_Naruto');s.collection.children.link(col)
studio=bpy.data.collections.new('Kitsu_Chibi_Naruto_Studio');s.collection.children.link(studio)
def B(p):return (p[0],-p[2],p[1])
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def mat(key,hexcolor):
    color=tuple(linear(int(hexcolor[i:i+2],16)/255) for i in (1,3,5))
    m=bpy.data.materials.new('Chibi_'+key);m.use_nodes=True;m.diffuse_color=(*color,1)
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs[0].default_value=(*color,1);n.inputs[2].default_value=.83;n.inputs[14].default_value=.12
    return m
M={k:mat(k,c) for k,c in {'Skin':'#ffc09a','Hair':'#ffd04d','Fabric':'#292b3e',
 'Metal':'#bac0d1','Details':'#515366','CheekMarks':'#b4765b','Mouth':'#994b36',
 'EyeWhites':'#fff2ec','Pupils':'#182836','Iris':'#439dce','Highlights':'#fffaf5'}.items()}
def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.parent=parent;o.location=B(pos);return o
root=empty('Chibi_Head',(0,.12,0));root['reviewStatus']='AWAITING_VISUAL_APPROVAL';root['assetVersion']='1.7.0-chibi-review'
root['attachment']='Existing coil origin and 0.12 Y mount';root['style']='Balanced game chibi; cute determination'
eyes=empty('Chibi_EyesPivot',(0,1.28,0),root);eyes['previewEye']=True
def mesh(name,v,f,key,parent=None,smooth=True):
    d=bpy.data.meshes.new(name);d.from_pydata([B(p) for p in v],[],f);d.update()
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parent or root
    if parent==eyes:o.location=B((0,-1.28,0))
    o['batch']=key;d.materials.append(M[key])
    if key in ('Hair','Fabric'):o['silhouette']=True
    for p in d.polygons:p.use_smooth=smooth
    return o
# Short squircle-like head: gently flattened temples and cohesive curved cheeks.
# Exposed face height .96 vs mature 1.20 = 20% shorter. No angular nose bridge.
CONTOURS=[(.62,.18,.37,-.31),(.68,.41,.53,-.45),(.79,.65,.665,-.60),
 (.96,.805,.755,-.725),(1.16,.87,.79,-.79),(1.38,.875,.755,-.805),
 (1.57,.845,.675,-.79),(1.76,.795,.535,-.745),(1.93,.64,.30,-.61),
 (2.055,.32,-.025,-.395),(2.10,0,-.22,-.22)]
def section(y):
    k=next((i for i in range(len(CONTOURS)-1) if CONTOURS[i][0]<=y<=CONTOURS[i+1][0]),len(CONTOURS)-2)
    p1,p2=CONTOURS[k:k+2];p0=CONTOURS[max(0,k-1)];p3=CONTOURS[min(len(CONTOURS)-1,k+2)]
    t=max(0,min(1,(y-p1[0])/(p2[0]-p1[0])))
    return tuple(.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t*t+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t*t*t) for j in (1,2,3))
def facez(x,y):
    w,front,rear=section(y);t=min(1,abs(x)/max(.001,w))
    z=front*sqrt(max(0,1-t**2.45))
    for side in (-1,1):z-=.015*exp(-((x-side*.36)/.22)**4-((y-1.28)/.18)**4)
    return z
v=[];f=[];N=48;rows=24
for j in range(rows+1):
    y=.62+(2.10-.62)*(1-cos(pi*j/rows))/2;w,front,rear=section(y)
    for i in range(N):
        a=2*pi*i/N;x=w*sin(a);z=facez(x,y) if cos(a)>=0 else abs(rear)*cos(a)
        v.append((x,y,z))
for j in range(rows):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
f.append(tuple(reversed(range(N))))
mesh('Chibi_SoftCheeks_Temples_TaperedChin',v,f,'Skin')
def tube(name,points,key,radius=.008,depth=.004,surface='face',offset=.013,parent=None):
    v=[];f=[];n=6
    for j,(x,y) in enumerate(points):
        before=points[max(0,j-1)];after=points[min(j+1,len(points)-1)]
        delta=Vector((after[0]-before[0],after[1]-before[1],0)).normalized();u=Vector((-delta.y,delta.x,0))
        taper=.6 if j in (0,len(points)-1) else 1
        for i in range(n):
            a=2*pi*i/n;xx=x+u.x*cos(a)*radius*taper;yy=y+u.y*cos(a)*radius*taper
            z=platez(xx,yy) if surface=='plate' else facez(xx,yy)
            v.append((xx,yy,z+offset+sin(a)*depth*taper))
    for j in range(len(points)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    f += [tuple(reversed(range(n))),tuple((len(points)-1)*n+i for i in range(n))]
    return mesh(name,v,f,key,parent)
def patch(name,center,outline,key,offset=.007,bulge=.014,parent=None,rows=3):
    cx,cy=center;n=len(outline);v=[(cx,cy,facez(cx,cy)+offset+bulge)];f=[]
    for j in range(1,rows+1):
        rho=j/rows
        for x,y in outline:
            xx=cx+(x-cx)*rho;yy=cy+(y-cy)*rho
            v.append((xx,yy,facez(xx,yy)+offset+bulge*(1-rho*rho)))
    for i in range(n):f.append((0,1+i,1+(i+1)%n))
    for j in range(rows-1):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    return mesh(name,v,f,key,parent)
def eye_bounds(dx):
    t=max(-1,min(1,dx/.22));h=sqrt(max(0,1-t*t))
    return (1.28-.17*h+.012*t,1.28+.18*h+.012*t-.013*(1-t)*h)
def disk(name,side,cx,cy,rx,ry,key,offset):
    outline=[]
    for i in range(28):
        a=2*pi*i/28;x=cx+rx*cos(a);y=cy+ry*sin(a)
        lo,hi=eye_bounds(side*(x-side*.36));y=max(lo,min(hi,y));outline.append((x,y))
    return patch(name,(cx,cy),outline,key,offset,.005,eyes)
for side in (-1,1):
    cx=side*.36;outline=[]
    for j in range(17):
        dx=-.22+.44*j/16;lo,hi=eye_bounds(dx);outline.append((cx+side*dx,hi))
    for j in range(16,-1,-1):
        dx=-.22+.44*j/16;lo,hi=eye_bounds(dx);outline.append((cx+side*dx,lo))
    patch('Chibi_CompactAlmondWhite_'+str(side),(cx,1.28),outline,'EyeWhites',.006,.016,eyes,4)
    disk('Chibi_IrisRim_'+str(side),side,cx,1.273,.108,.132,'Pupils',.026)
    disk('Chibi_BlueIris_'+str(side),side,cx,1.273,.096,.120,'Iris',.032)
    disk('Chibi_SmallDarkPupil_'+str(side),side,cx,1.273,.045,.051,'Pupils',.039)
    disk('Chibi_SmallGlint_'+str(side),side,cx-.028,1.321,.018,.023,'Highlights',.046)
    upper=[(cx+side*(-.21+.42*j/20),eye_bounds(-.21+.42*j/20)[1]) for j in range(21)]
    tube('Chibi_SoftUpperLid_'+str(side),upper,'Skin',.010,.004,offset=.014)
    tube('Chibi_UpperEyeAccent_'+str(side),upper,'Pupils',.004,.002,offset=.021,parent=eyes)
    brow=[(side*.22,1.425),(side*.31,1.462),(side*.44,1.500),(side*.57,1.529)]
    tube('Chibi_GentleBrowOutline_'+str(side),brow,'CheekMarks',.013,.004,offset=.014)
    tube('Chibi_BlondBrow_'+str(side),brow,'Hair',.008,.002,offset=.022)
    for j,(a,b) in enumerate([((.59,1.10),(.77,1.075)),((.58,.998),(.755,.965)),((.545,.902),(.708,.866))]):
        points=[(side*(a[0]+(b[0]-a[0])*t/10),a[1]+(b[1]-a[1])*t/10) for t in range(11)]
        tube('Chibi_FlushWhisker_'+str(side)+'_'+str(j),points,'CheekMarks',.005,.0025,offset=.012)
mouth=[(-.105+.21*j/12,.862+.009*sin(pi*j/12)) for j in range(13)]
tube('Chibi_TinyDeterminedFrown',mouth,'Mouth',.007,.004,offset=.013)
# Small rounded nose, no long bridge or anatomical nostrils.
v=[];f=[];N=20;rows=10;c=(0,1.071,facez(0,1.071)+.012)
for j in range(rows+1):
    t=pi*j/rows
    for i in range(N):
        a=2*pi*i/N;v.append((c[0]+.068*sin(t)*cos(a),c[1]+.062*cos(t),c[2]+.068*sin(t)*sin(a)))
for j in range(rows):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
mesh('Chibi_SmallRoundedNose',v,f,'Skin')
# Thin 0.34-high ears, sculpted helix and recessed concha, leaned outward mildly.
for side in (-1,1):
    v=[];f=[];N=20
    for scale,z in [(0,.020),(.43,.022),(.67,.047),(.84,.063),(1,.010),(.80,-.045),(0,-.053)]:
        for i in range(N):
            a=2*pi*i/N;dx=.090*cos(a)*scale;dy=.170*sin(a)*scale
            v.append((side*(.891+dx+.10*dy),1.20+dy,.020+z))
    for j in range(6):
        for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
    mesh('Chibi_ThinRecessedEar_'+str(side),v,f,'Skin')
# One continuous scalp. Exactly 15 individually bent locks grow from shared
# scalp boundaries. Intermediate rings provide rounded roots and gentle ridges.
SCALP=[(1.80,.87,.43,-.73),(1.98,.88,.54,-.79),(2.19,.73,.39,-.74),
       (2.37,.46,.14,-.58),(2.47,.22,-.08,-.42),(2.51,0,-.25,-.25)]
LOCKS={
 (1,22):((-.49,1.85,.715),(-.025,.025,.040),'Fringe_LeftOuter'),
 (1,23):((-.16,1.90,.760),(-.020,.035,.035),'Fringe_LeftInner'),
 (1,0):((.19,1.86,.755),(.030,.020,.040),'Fringe_RightInner'),
 (1,1):((.53,1.84,.695),(.040,.020,.025),'Fringe_RightOuter'),
 (2,22):((-.66,2.63,.06),(-.09,.050,.035),'Crown_LeftSweep'),
 (2,0):((.35,2.66,-.06),(.075,.040,.02),'Crown_CenterSweep'),
 (2,2):((.72,2.60,-.09),(.09,.02,-.02),'Crown_RightSweep'),
 (2,11):((-.20,2.64,-.71),(-.050,.025,-.035),'Crown_RearCenter'),
 (2,14):((-.58,2.57,-.64),(-.075,.02,-.015),'Crown_RearLeft'),
 (1,4):((1.22,2.39,-.10),(.070,.050,.015),'Side_Right'),
 (1,19):((-1.22,2.34,-.12),(-.065,.025,.01),'Side_Left'),
 (1,8):((.75,2.38,-.96),(.04,.06,-.06),'Rear_Right'),
 (1,11):((.20,2.43,-1.035),(.065,.05,-.07),'Rear_Center'),
 (1,14):((-.48,2.36,-.99),(-.035,.035,-.075),'Rear_Left'),
 (0,12):((.035,1.94,-.985),(.06,-.03,-.075),'Rear_Lower')}
v=[];f=[];smooth_flags=[];N=24
for y,w,front,rear in SCALP:
    for i in range(N):
        a=2*pi*i/N;v.append((w*sin(a),y,(front+rear)/2+(front-rear)/2*cos(a)))
for j in range(len(SCALP)-1):
    for i in range(N):
        boundary=[j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i]
        if (j,i) not in LOCKS:f.append(tuple(boundary));smooth_flags.append(True);continue
        end,bend,label=LOCKS[(j,i)];tip=Vector(end);base=sum((Vector(v[k]) for k in boundary),Vector())/4
        last=boundary
        for t,width in [(.30,.92),(.68,.44)]:
            center=base+(tip-base)*t+Vector(bend)*sin(pi*t);ring=[]
            for k,index in enumerate(boundary):
                delta=Vector(v[index])-base;p=center+delta*width*(.91 if k in (2,3) else 1)
                ring.append(len(v));v.append(tuple(p))
            for k in range(4):kk=(k+1)%4;f.append((last[k],last[kk],ring[kk],ring[k]));smooth_flags.append(True)
            last=ring
        apex=len(v);v.append(tuple(tip))
        for k in range(4):f.append((last[k],last[(k+1)%4],apex));smooth_flags.append(True)
hair=mesh('Chibi_ConnectedScalp_15ShapedLocks',v,f,'Hair');hair['lockCount']=15
hair['lockNames']=','.join(value[2] for value in LOCKS.values())
for poly,sm in zip(hair.data.polygons,smooth_flags):poly.use_smooth=sm
hair.data.set_sharp_from_angle(angle=.68)
for side in (-1,1):
    v=[(side*.79,1.80,-.120),(side*.871,1.73,-.115),(side*.875,1.17,.060),(side*.815,1.23,.095),
       (side*.78,1.80,-.190),(side*.86,1.72,-.180),(side*.864,1.18,-.045),(side*.805,1.24,-.015)]
    mesh('Chibi_ShortSideburn_'+str(side),v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'Hair')
v=[];f=[];N=24;levels=[(1.00,.81,-.73),(1.18,.90,-.84),(1.41,.92,-.875),(1.68,.90,-.86),(1.92,.82,-.80)]
for j,(y,w,rear) in enumerate(levels):
    for i in range(N+1):
        a=pi*.51+pi*.98*i/N;ridge=.010*(1+cos(2*pi*i/6))
        yy=y-(.06+.055*cos(2*pi*i/6)) if j==0 else y
        v.append(((w+ridge)*sin(a),yy,(abs(rear)+ridge)*cos(a)-.035))
for j in range(len(levels)-1):
    for i in range(N):a=j*(N+1)+i;f.append((a,a+1,a+N+2,a+N+1))
mesh('Chibi_CoherentNape',v,f,'Hair')
# Fitted band retains enough lateral and rear clearance for skull and hair.
def bandz(x,y):return facez(x,y)+.050
v=[];f=[];N=48
for y,thickness in [(1.58,.015),(1.596,.030),(1.650,.030),(1.705,.030),(1.759,.030),(1.812,.030),(1.828,.014),(1.828,0),(1.58,0)]:
    w=.905
    for i in range(N):
        a=2*pi*i/N;x=(w+.023+thickness)*sin(a)
        if cos(a)>=0:
            if abs(x)<=.835:z=facez(x,y)+.035+thickness
            else:
                t=(abs(x)-.835)/(w+.023+thickness-.835)
                z=(facez(.835,y)+.035+thickness)*(1-t)-.035*t
        else:z=-.035+(.875+thickness+.035)*cos(a)
        v.append((x,y+.012*(1-cos(a)),z))
for j in range(9):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;k=(j+1)%9*N;f.append((a,b,k+(i+1)%N,k+i))
band=mesh('Chibi_ThinFittedHeadband',v,f,'Fabric');band['ringSegments']=48;band['ringCount']=9
outline=[]
for i in range(32):
    a=2*pi*i/32;outline.append((.38*math.copysign(abs(cos(a))**.32,cos(a)),1.706+.095*math.copysign(abs(sin(a))**.32,sin(a))))
v=[];f=[];N=len(outline)
for offset,scale in [(.009,.965),(.020,1),(.034,.965)]:
    for x,y in outline:
        xx=x*scale;yy=1.706+(y-1.706)*scale;v.append((xx,yy,bandz(xx,yy)+offset))
for j in range(2):
    for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
center=len(v);v.append((0,1.706,bandz(0,1.706)+.034))
for i in range(N):f.append((center,2*N+i,2*N+(i+1)%N))
mesh('Chibi_CompactSilverLeafPlate',v,f,'Metal')
def platez(x,y):return bandz(x,y)+.034
spiral=[]
for j in range(33):
    t=j/32;a=-pi/2+2*pi*1.32*t;r=.006+.047*t;spiral.append((-.005+r*cos(a),1.710+r*sin(a)))
spiral += [(.049,1.752),(.104,1.758),(.114,1.746),(.064,1.739)]
tube('Chibi_LeafSpiral',spiral,'Details',.006,.002,'plate',.003)
tube('Chibi_LeafStem',[(-.035,1.673),(-.074,1.644),(-.112,1.650),(-.078,1.689)],'Details',.006,.002,'plate',.003)
for side in (-1,1):
    for j,y in enumerate((1.650,1.706,1.762)):
        cx=side*.327;v=[(cx,y,platez(cx,y)+.007)]
        v.extend((cx+.011*cos(2*pi*i/12),y+.011*sin(2*pi*i/12),platez(cx+.011*cos(2*pi*i/12),y+.011*sin(2*pi*i/12))+.002) for i in range(12))
        mesh('Chibi_Rivet_'+str(side)+'_'+str(j),v,[(0,1+i,1+(i+1)%12) for i in range(12)],'Metal')
v=[(-.075,1.65,-.955),(.075,1.65,-.955),(.075,1.79,-.955),(-.075,1.79,-.955),
   (-.052,1.674,-1.035),(.052,1.674,-1.035),(.052,1.766,-1.035),(-.052,1.766,-1.035)]
mesh('Chibi_RearKnot',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'Fabric')
for side in (-1,1):
    v=[];f=[]
    for x,y,z,w in [(side*.025,1.70,-1.01,.032),(side*.09,1.46,-1.065,.045),(side*.155,1.22,-1.07,.059),(side*.195,1.02,-1.025,.064)]:
        for dx,dz in [(-w,-.011),(w,-.011),(w,.011),(-w,.011)]:v.append((x+dx,y,z+dz))
    for j in range(3):
        for i in range(4):a=j*4+i;b=j*4+(i+1)%4;f.append((a,b,b+4,a+4))
    f += [(3,2,1,0),(12,13,14,15)];mesh('Chibi_RearFabricTie_'+str(side),v,f,'Fabric')
s.world=bpy.data.worlds.new('Chibi_StudioWorld');s.world.use_nodes=True
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.79,.82,.88,1);bg.inputs[1].default_value=.60
def aim(o,p):o.rotation_euler=(Vector(B(p))-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,4.5,5),260,5),('Fill',(4,2.5,4),170,4),('Rim',(-1,4,-4),200,3)]:
    d=bpy.data.lights.new('Chibi_'+name,'AREA');d.energy=power;d.size=size
    o=bpy.data.objects.new(d.name,d);studio.objects.link(o);o.location=B(pos);aim(o,(0,1.60,0))
d=bpy.data.cameras.new('Chibi_ReviewCamera');c=bpy.data.objects.new(d.name,d);studio.objects.link(c);d.type='ORTHO';d.ortho_scale=3.15
c.location=B((0,1.60,7));aim(c,(0,1.60,0));s.camera=c
s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.film_transparent=True
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=-.15
s.render.filepath=OUT+'/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        view=area.spaces.active.region_3d;view.view_perspective='CAMERA';view.view_rotation=c.rotation_euler.to_quaternion();view.view_camera_zoom=0
        area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-chibi-naruto.blend')
print(json.dumps({'scene':s.name,'collection':col.name,'masterTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH'),'hairLocks':len(LOCKS),'faceHeightReduction':.20}))
