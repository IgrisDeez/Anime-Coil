"""Naruto reference candidate: authored face contours and connected hair topology.
No chibi generator, ellipsoid face, or repeated leaf/cone hair construction.
Run this source through Blender MCP. Existing scenes and game exports are preserved.
"""
import bpy, bmesh, math, json
from mathutils import Vector
from math import sin, cos, pi, sqrt, exp
OUT='C:/Users/denze/Documents/Codex/2026-09-23/i-want-x20/outputs/anime-coil/assets/kitsu/candidates/anime-reference'
old=bpy.data.scenes.get('Kitsu_AnimeReference_Review')
if old:
    bpy.context.window.scene=bpy.data.scenes['Kitsu_Reference_Studio_169']
    for col in list(old.collection.children):
        for obj in list(col.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(col)
    bpy.data.scenes.remove(old)
s=bpy.data.scenes.new('Kitsu_AnimeReference_Review');bpy.context.window.scene=s
col=bpy.data.collections.new('Kitsu_AnimeReference_Editable');s.collection.children.link(col)
studio=bpy.data.collections.new('Kitsu_AnimeReference_Studio');s.collection.children.link(studio)
def B(p):return (p[0],-p[2],p[1])
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def mat(key,hexcolor):
    color=tuple(linear(int(hexcolor[i:i+2],16)/255) for i in (1,3,5))
    m=bpy.data.materials.new('AnimeRef_'+key);m.use_nodes=True;m.diffuse_color=(*color,1)
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs[0].default_value=(*color,1);n.inputs[2].default_value=.82;n.inputs[14].default_value=.12
    return m
M={k:mat(k,c) for k,c in {
 'Skin':'#efb292','Hair':'#ffe12a','Fabric':'#172b47','Metal':'#aeb5c0',
 'Details':'#353442','CheekMarks':'#80604e','Mouth':'#93634f',
 'EyeWhites':'#f9f5f0','Pupils':'#162c38','Iris':'#439dce','Highlights':'#fffef9'
}.items()}
def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.parent=parent;o.location=B(pos);return o
root=empty('AnimeRef_Head',(0,.12,0));root['reviewStatus']='AWAITING_VISUAL_APPROVAL';root['assetVersion']='1.6.9';root['attachment']='Existing coil origin, +0.12 Y mount'
eyes=empty('AnimeRef_EyesPivot',(0,1.57,0),root);eyes['previewEye']=True
def mesh(name,v,f,key,parent=None,smooth=True):
    if name.startswith('AnimeRef_RearKnot') or name.startswith('AnimeRef_RearTie'):
        v=[(x,y,z-.065) for x,y,z in v]
    d=bpy.data.meshes.new(name);d.from_pydata([B(p) for p in v],[],f);d.update()
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parent or root
    if parent==eyes:o.location=B((0,-1.57,0))
    o['batch']=key;d.materials.append(M[key])
    if key in ('Hair','Fabric'):o['silhouette']=True
    for p in d.polygons:p.use_smooth=smooth
    return o
RINGS=[(.60,.20,.40,-.34),(.67,.32,.49,-.41),(.82,.58,.60,-.50),
 (1.02,.73,.65,-.59),(1.24,.805,.665,-.655),(1.49,.85,.63,-.71),
 (1.74,.87,.58,-.725),(1.94,.825,.50,-.70),(2.12,.72,.34,-.61),
 (2.26,.44,.065,-.40),(2.31,0,-.13,-.13)]
FRONT=[(0,1),(.05,.998),(.10,.994),(.18,.985),(.30,.958),(.47,.891),(.68,.756),(.86,.558),(1,.24)]
def section(y):
    i=next((i for i in range(len(RINGS)-1) if RINGS[i][0]<=y<=RINGS[i+1][0]),len(RINGS)-2)
    a,b=RINGS[i:i+2];t=max(0,min(1,(y-a[0])/(b[0]-a[0])))
    return tuple(a[j]*(1-t)+b[j]*t for j in (1,2,3))
def scalez(t):
    t=max(0,min(1,t));i=next((i for i in range(len(FRONT)-1) if FRONT[i][0]<=t<=FRONT[i+1][0]),len(FRONT)-2)
    a,b=FRONT[i:i+2];u=(t-a[0])/(b[0]-a[0]);return a[1]*(1-u)+b[1]*u
def facez(x,y):
    w,f,r=section(y);z=f*scalez(abs(x)/max(.001,w))
    z+=.025*exp(-(x/.07)**2-((y-1.39)/.18)**2)
    z+=.075*exp(-(x/.058)**2-((y-1.165)/.065)**2)
    for side in (-1,1):z-=.013*exp(-((x-side*.43)/.19)**4-((y-1.57)/.12)**4)
    return z
v=[];f=[]
ys=[]
for j in range(len(RINGS)-1):ys.extend([RINGS[j][0],(RINGS[j][0]+RINGS[j+1][0])/2])
ys.append(RINGS[-1][0])
for y in ys:
    w,front,rear=section(y)
    pts=[(w*t,y,facez(w*t,y)) for t,z in FRONT]
    pts += [(w,y,-.08),(.88*w,y,.58*rear),(.53*w,y,.89*rear),(0,y,rear)]
    pts += [(-x,yy,z) for x,yy,z in reversed(pts[1:-1])]
    v.extend(pts)
n=len(v)//len(ys)
for j in range(len(ys)-1):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
f.append(tuple(reversed(range(n))))
mesh('AnimeRef_AngularFace_Temples_Cheekbones_Jaw',v,f,'Skin')
# All drawn facial details are thin mesh relief following the actual face surface.
def tube(name,points,key,radius=.009,depth=.006,surface='face',offset=.012,parent=None):
    v=[];f=[];n=6
    for j,(x,y) in enumerate(points):
        before=points[max(0,j-1)];after=points[min(j+1,len(points)-1)]
        tangent=Vector((after[0]-before[0],after[1]-before[1],0)).normalized();u=Vector((-tangent.y,tangent.x,0))
        taper=.65 if j in (0,len(points)-1) else 1
        for i in range(n):
            a=2*pi*i/n;xx=x+u.x*cos(a)*radius*taper;yy=y+u.y*cos(a)*radius*taper
            z=platez(xx,yy) if surface=='plate' else facez(xx,yy)
            v.append((xx,yy,z+offset+sin(a)*depth*taper))
    for j in range(len(points)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    f += [tuple(reversed(range(n))),tuple((len(points)-1)*n+i for i in range(n))]
    return mesh(name,v,f,key,parent)
def shape_patch(name,center,outline,key,offset=.005,bulge=.008,parent=None,rows=3):
    cx,cy=center;n=len(outline);v=[(cx,cy,facez(cx,cy)+offset+bulge)];f=[]
    for j in range(1,rows+1):
        rho=j/rows
        for x,y in outline:
            xx=cx+(x-cx)*rho;yy=cy+(y-cy)*rho;v.append((xx,yy,facez(xx,yy)+offset+bulge*(1-rho*rho)))
    for i in range(n):f.append((0,1+i,1+(i+1)%n))
    for j in range(rows-1):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    return mesh(name,v,f,key,parent)
def eye_bounds(dx):
    # Shallow almond aperture, slightly lifted outer corner.
    t=dx/.19;upper=1.645+.025*t-.020*t*t
    lower=1.480+.025*t+.125*t*t
    return lower,upper
def eye_disk(name,side,cx,cy,rx,ry,key,offset):
    outline=[]
    for i in range(32):
        a=2*pi*i/32;x=cx+rx*cos(a);y=cy+ry*sin(a)
        lo,hi=eye_bounds(side*(x-side*.43));y=max(lo,min(hi,y));outline.append((x,y))
    return shape_patch(name,(cx,cy),outline,key,offset,.004,eyes,3)
for side in (-1,1):
    cx=side*.43;outline=[]
    for j in range(13):
        dx=-.19+.38*j/12;lo,hi=eye_bounds(dx);outline.append((cx+side*dx,hi))
    for j in range(12,-1,-1):
        dx=-.19+.38*j/12;lo,hi=eye_bounds(dx);outline.append((cx+side*dx,lo))
    shape_patch('AnimeRef_AlmondEyeWhite_'+str(side),(cx,1.57),outline,'EyeWhites',.005,.008,eyes,4)
    eye_disk('AnimeRef_IrisDarkRim_'+str(side),side,cx,1.568,.077,.080,'Pupils',.020)
    eye_disk('AnimeRef_BlueIris_'+str(side),side,cx,1.568,.065,.068,'Iris',.024)
    eye_disk('AnimeRef_SmallPupil_'+str(side),side,cx,1.570,.032,.038,'Pupils',.029)
    eye_disk('AnimeRef_EyeGlint_'+str(side),side,cx-.023,1.598,.014,.020,'Highlights',.034)
    tube('AnimeRef_UpperLash_'+str(side),[(cx+side*(-.19+.38*j/18),eye_bounds(-.19+.38*j/18)[1]) for j in range(19)],'Details',.010,.004,offset=.015)
    tube('AnimeRef_LowerLid_'+str(side),[(cx+side*(-.18+.36*j/18),eye_bounds(-.18+.36*j/18)[0]) for j in range(19)],'CheekMarks',.004,.003,offset=.008)
    # Outer ends rise; inner ends lower to give the focused expression in the image.
    brow=[(side*.23,1.625),(side*.34,1.678),(side*.48,1.715),(side*.63,1.746)]
    tube('AnimeRef_DeterminedBrow_'+str(side),brow,'Details',.012,.004,offset=.014)
    tube('AnimeRef_BlondBrowInset_'+str(side),brow,'Hair',.006,.002,offset=.020)
    tube('AnimeRef_BrowCrease_'+str(side),[(side*.185,1.656),(side*.17,1.615)],'CheekMarks',.004,.002,offset=.006)
    whiskers=[[(side*.50,1.365),(side*.74,1.335)],[(side*.50,1.235),(side*.755,1.17)],[(side*.47,1.125),(side*.69,1.035)]]
    for j,points in enumerate(whiskers):
        a,b=points;sampled=[(a[0]+(b[0]-a[0])*t/12,a[1]+(b[1]-a[1])*t/12) for t in range(13)]
        tube('AnimeRef_ThinWhisker_'+str(side)+'_'+str(j),sampled,'CheekMarks',.005,.003,offset=.018)
    tube('AnimeRef_Nostril_'+str(side),[(side*.026,1.141),(side*.046,1.150)],'CheekMarks',.004,.002,offset=.011)
tube('AnimeRef_DeterminedMouth',[(-.20,.900),(-.13,.911),(0,.919),(.13,.911),(.20,.900)],'Mouth',.006,.003,offset=.012)
# A narrow nose bridge and small angular tip, buried at its skin boundary.
nosexy=[(0,1.45),(-.038,1.20),(-.036,1.155),(0,1.132),(.040,1.155),(.026,1.31),(0,1.17)]
nosev=[(x,y,facez(x,y)+(.028 if i==6 else .012 if i in (2,3,4) else .001)) for i,(x,y) in enumerate(nosexy)]
mesh('AnimeRef_SubtleAngularNoseBridge',nosev,[(6,i,(i+1)%6) for i in range(6)],'Skin')
# Slender anatomical ears with folded helix; no circular disk primitives.
ear_outline=[(-.065,.23),(.035,.245),(.11,.15),(.105,-.025),(.025,-.215),(-.045,-.22),(-.095,-.09),(-.09,.10)]
for side in (-1,1):
    v=[];f=[];n=len(ear_outline)
    for k,z in [(0,.018),(.40,.015),(.68,.071),(.86,.095),(1,.018),(.80,-.055),(0,-.065)]:
        for x,y in ear_outline:
            xx=side*(.872+x*k);yy=1.48+y*k;zz=-.08+z
            v.append((xx,yy,zz))
    for j in range(6):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
    mesh('AnimeRef_SlenderFoldedEar_'+str(side),v,f,'Skin')
# Connected scalp with authored local face extrusions. Shared root vertices make
# crown, side and rear spikes one continuous mesh without intersecting primitives.
SCALP=[(2.075,.86,.445,-.71),(2.30,.96,.47,-.79),(2.53,.79,.28,-.72),
       (2.71,.57,.035,-.585),(2.84,.33,-.105,-.44),(2.91,0,-.255,-.255)]
v=[];f=[];smooth_faces=[];n=24
for y,w,front,rear in SCALP:
    for i in range(n):
        a=2*pi*i/n;centerz=(front+rear)/2;rz=(front-rear)/2
        v.append((w*sin(a),y,centerz+rz*cos(a)))
SPIKES={
 (1,22):(-.73,2.88,.16), (2,22):(-.38,3.06,.045), (2,0):(.16,3.045,.035),
 (2,2):(.67,2.995,-.065), (1,4):(1.08,2.84,-.06), (1,19):(-1.09,2.82,-.145),
 (1,5):(1.27,2.57,-.23), (1,18):(-1.27,2.48,-.245),
 (0,5):(1.16,2.20,-.28), (0,18):(-1.16,2.16,-.30),
 (2,5):(.87,2.975,-.295), (2,18):(-.81,3.025,-.325),
 (3,20):(-.52,3.055,-.25), (3,2):(.44,3.01,-.265),
 (2,8):(.60,2.95,-.77), (2,11):(-.10,3.055,-.67), (2,14):(-.66,2.98,-.68),
 (1,9):(.62,2.55,-1.04), (1,12):(-.10,2.63,-1.12), (1,15):(-.68,2.49,-1.07),
 (0,8):(.84,2.24,-.93), (0,11):(.13,2.23,-1.07), (0,14):(-.58,2.17,-1.02),
 (0,17):(-1.09,2.33,-.58), (0,6):(1.08,2.36,-.55)
}
for j in range(len(SCALP)-1):
    for i in range(n):
        a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+(i+1)%n;d=(j+1)*n+i
        boundary=[a,b,c,d]
        if (j,i) not in SPIKES:
            f.append(tuple(boundary));smooth_faces.append(True);continue
        tip=Vector(SPIKES[(j,i)]);base=sum((Vector(v[k]) for k in boundary),Vector())/4
        mid=base+(tip-base)*.47
        middle=[]
        for k,index in enumerate(boundary):
            delta=Vector(v[index])-base
            width=(.80,.73,.46,.58)[k]
            p=mid+delta*width;middle.append(len(v));v.append(tuple(p))
        for k in range(4):
            kk=(k+1)%4;f.append((boundary[k],boundary[kk],middle[kk],middle[k]));smooth_faces.append(False)
        apex=len(v);v.append(tuple(tip))
        for k in range(4):f.append((middle[k],middle[(k+1)%4],apex));smooth_faces.append(False)
v=[(x*.91,2.075+(y-2.075)*.87,z) for x,y,z in v]
hair=mesh('AnimeRef_ConnectedLayeredSpikyHair',v,f,'Hair')
for polygon,sm in zip(hair.data.polygons,smooth_faces):polygon.use_smooth=sm
# Skull-fitting sideburn/nape panels join at buried roots; sharp, varied ends.
for side in (-1,1):
    verts=[(side*.78,1.96,.045),(side*.87,1.87,.03),(side*.865,1.34,.035),(side*.795,1.43,.075),
           (side*.76,1.95,-.10),(side*.85,1.85,-.12),(side*.845,1.36,-.08),(side*.775,1.45,-.055)]
    faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    mesh('AnimeRef_TaperedSideburn_'+str(side),verts,faces,'Hair')
# Rear hair shell follows the occiput and ends in an uneven pointed neckline.
v=[];f=[];n=20;levels=[(1.08,.78,-.72),(1.30,.88,-.78),(1.52,.925,-.81),(1.76,.935,-.81),(1.96,.90,-.79),(2.12,.86,-.76)]
for j,(y,w,rear) in enumerate(levels):
    for i in range(n+1):
        a=pi*.46+pi*1.08*i/n
        ridge=.012*(1+cos(2*pi*i/4))*(1 if j<len(levels)-1 else 0)
        xx=(w+ridge)*sin(a);zz=(abs(rear)+ridge)*cos(a)-.035
        yy=y-(.10+.08*cos(7*(a-pi))) if j==0 else y
        v.append((xx,yy,zz))
for j in range(len(levels)-1):
    for i in range(n):a=j*(n+1)+i;f.append((a,a+1,a+n+2,a+n+1))
mesh('AnimeRef_FittedPointedNape',v,f,'Hair')
# Fitted navy cloth and curved plate. Metal follows the same skull surface in Y.
def bandz(x,y):return facez(x,y)+.054
v=[];f=[];n=48
for y,thickness in [(1.80,.019),(1.818,.035),(2.108,.035),(2.126,.018),(2.126,0),(1.80,0)]:
    w=.93
    for i in range(n):
        a=2*pi*i/n;xx=(w+.031+thickness)*sin(a)
        if cos(a)>=0:
            if abs(xx)<=.85:zz=facez(xx,y)+.019+thickness
            else:
                t=(abs(xx)-.85)/(w+.031+thickness-.85)
                zz=(facez(.85,y)+.019+thickness)*(1-t)-.035*t
        else:zz=-.035+(.86+thickness+.019)*cos(a)
        v.append((xx,y+.018*(1-cos(a)),zz))
for j in range(6):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;k=(j+1)%6*n;f.append((a,b,k+(i+1)%n,k+i))
mesh('AnimeRef_FittedNavyHeadband',v,f,'Fabric')
plate_outline=[]
for i in range(32):
    a=2*pi*i/32;plate_outline.append((.51*math.copysign(abs(cos(a))**.30,cos(a)),1.965+.139*math.copysign(abs(sin(a))**.30,sin(a))))
v=[];f=[];n=len(plate_outline)
for off,k in [(.013,.97),(.025,1),(.045,.97)]:
    for x,y in plate_outline:
        xx=x*k;yy=1.965+(y-1.965)*k;v.append((xx,yy,bandz(xx,yy)+off))
for j in range(2):
    for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
ci=len(v);v.append((0,1.965,bandz(0,1.965)+.045))
for i in range(n):f.append((ci,2*n+i,2*n+(i+1)%n))
mesh('AnimeRef_CurvedLeafPlate',v,f,'Metal')
def platez(x,y):return bandz(x,y)+.045
spiral=[]
for j in range(41):
    t=j/40;a=-pi/2+2*pi*1.45*t;r=.012+.068*t;spiral.append((-.016+r*cos(a),1.965+r*sin(a)))
spiral += [(.075,2.013),(.145,2.028),(.17,2.011),(.098,1.996)]
tube('AnimeRef_LeafSpiral',spiral,'Details',.009,.002,'plate',.002)
tube('AnimeRef_LeafStem',[(-.052,1.906),(-.115,1.862),(-.173,1.870),(-.12,1.932)],'Details',.009,.002,'plate',.002)
for side in (-1,1):
    for j,y in enumerate((1.875,1.965,2.055)):
        cx=side*.443;outline=[(cx+.014*cos(2*pi*i/12),y+.014*sin(2*pi*i/12)) for i in range(12)]
        v=[(cx,y,platez(cx,y)+.009)]+[(x,yy,platez(x,yy)+.004) for x,yy in outline]
        f=[(0,1+i,1+(i+1)%12) for i in range(12)];mesh('AnimeRef_Rivet_'+str(side)+'_'+str(j),v,f,'Metal')
# Rear knot and thin trailing ties; no collar or unrelated body details.
mesh('AnimeRef_RearKnot',[(-.085,1.87,-.82),(.085,1.87,-.82),(.09,2.05,-.82),(-.09,2.05,-.82),
 (-.06,1.9,-.92),(.06,1.9,-.92),(.06,2.02,-.92),(-.06,2.02,-.92)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'Fabric')
for side in (-1,1):
    v=[];f=[]
    for x,y,z,w in [(side*.03,1.92,-.88,.04),(side*.11,1.62,-.94,.055),(side*.19,1.31,-.96,.072),(side*.23,1.05,-.92,.078)]:
        for dx,dz in [(-w,-.012),(w,-.012),(w,.012),(-w,.012)]:v.append((x+dx,y,z+dz))
    for j in range(3):
        for i in range(4):a=j*4+i;b=j*4+(i+1)%4;f.append((a,b,b+4,a+4))
    f += [(3,2,1,0),(12,13,14,15)];mesh('AnimeRef_RearTie_'+str(side),v,f,'Fabric')
s.world=bpy.data.worlds.new('AnimeRef_StudioWorld');s.world.use_nodes=True
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.78,.80,.85,1);bg.inputs[1].default_value=.7
def aim(o,p):o.rotation_euler=(Vector(B(p))-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,5,5),340,5),('Fill',(4,2.5,4),180,4),('Rim',(-1,4,-4),220,3)]:
    d=bpy.data.lights.new('AnimeRef_'+name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(d.name,d);studio.objects.link(o);o.location=B(pos);aim(o,(0,1.85,0))
d=bpy.data.cameras.new('AnimeRef_ReviewCamera');c=bpy.data.objects.new(d.name,d);studio.objects.link(c);d.type='ORTHO';d.ortho_scale=3.45;c.location=B((0,1.85,7));aim(c,(0,1.85,0));s.camera=c
s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=True
s.view_settings.view_transform=bpy.data.scenes['Kitsu_Reference_Studio_169'].view_settings.view_transform
s.view_settings.exposure=-.15;s.render.filepath=OUT+'/front.png'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kitsu-anime-reference.blend')
print(json.dumps({'scene':s.name,'meshes':sum(o.type=='MESH' for o in col.objects),'masterTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in col.objects if o.type=='MESH')}))
