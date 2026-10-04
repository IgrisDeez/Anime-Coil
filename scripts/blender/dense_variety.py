import bpy,bmesh,math,json
def append_city_varieties(profile):
    s=bpy.data.scenes['Dense_Shibuya_V178'];bpy.context.window.scene=s
    col=bpy.data.collections['Dense_Shibuya_'+profile];root=bpy.data.objects['ShibuyaKit_'+profile]
    stone=bpy.data.objects['City_Shop_Stone_'+profile].data.materials[0];windows=bpy.data.objects['City_Shop_Windows_'+profile].data.materials[0];atlas=bpy.data.objects['City_Shop_Atlas_'+profile].data.materials[0]
    n=3 if profile=='desktop' else 2
    for idx,family in enumerate(['Hotel','Civic','RoofGarden','SlantTower']):
        if bpy.data.objects.get('City_'+family+'_'+profile):continue
        g=empty('City_'+family+'_'+profile,col,root);g['family']=family;g['baseSize']=[18,48,14]
        a=collector();e=collector();p=collector();ink='#142337';trim='#687b8a';navy=['#56444c','#697078','#384f60','#34415b'][idx]
        box(a,0,3.7,0,18,7.4,14,ink)
        for x in [-6,-2,2,6]:box(e,x,3.4,7.03,3.6,5.5,.08,'#d9b081')
        box(a,0,7.7,7.2,18.5,.45,1.8,trim)
        if family=='Hotel':
            box(a,0,25,-.6,17.4,34,12.6,navy);panel(p,0,25,5.76,16,33,8)
            for y in ([12,18,24,30,36,42] if profile=='desktop' else [13,23,33,42]):
                for x in [-4.1,4.1]:
                    box(a,x,y-1.2,6.7,7.6,.35,2.4,trim)
                    box(a,x,y-.5,7.83,7.5,1.1,.16,'#465766')
                    box(e,x,y+1,5.91,5.3,2.6,.08,'#d0b08c')
            box(a,-2,45,-1,12,6,10,navy);box(a,-2,48,-1,12.6,.4,10.6,trim)
        elif family=='Civic':
            box(a,0,25,0,18,34,14,navy);panel(p,0,25,7.02,14,28,5)
            for x in [-7.4,0,7.4]:box(a,x,26,7.22,.6,34,.5,'#9aa39f')
            for y in [16,26,36]:box(a,0,y,7.15,18.4,.6,1.2,trim)
            # A shallow gable creates an identifiable civic/library silhouette.
            add(a,[(-9,42,-7),(9,42,-7),(0,49,-7),(-9,42,7),(9,42,7),(0,49,7)],[(0,2,1),(3,4,5),(0,1,4,3),(0,3,5,2),(1,2,5,4)],'#354655')
            box(e,0,44.2,7.07,5,1.2,.08,'#b0c7c8')
        elif family=='RoofGarden':
            for x,y,z,w,h,d in [(0,18,0,18,20,14),(-2,34,-1,14,12,12),(1,43,-2,10,6,10)]:
                round_box(a,x,y,z,w,h,d,.7,navy,n);panel(p,x,y,z+d/2+.025,w-1,h-1,6)
                box(a,x,y+h/2+.3,z,w+.5,.5,d+.5,trim)
                for side in [-1,1]:
                    box(a,x+side*(w/2-1),y+h/2+.8,z,1.5,1,d-1,'#726451')
                    round_box(a,x+side*(w/2-1),y+h/2+1.5,z,1.4,1.5,d-1,.6,'#547766',n)
            box(e,-2,18,7.12,11,5,.08,'#8caaa6')
        else:
            # A cut crown and offset double volumes break up the skyline.
            box(a,-3,24,-1,12,32,12,navy);box(a,6,19,-1,5.4,22,12,'#455870')
            panel(p,-3,24,5.04,10.7,30,1);panel(p,6,19,5.04,4.6,20,2)
            add(a,[(-9,40,-7),(3,40,-7),(3,43,-7),(-9,50,-7),(-9,40,5),(3,40,5),(3,43,5),(-9,50,5)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],'#607184')
            for x in [-7,-4,-1]:box(e,x,24,5.15,.36,30,.12,'#99bac6')
            box(a,5.8,31,0,6,1,12,trim)
        panel(p,0,3.3,7.12,6,5,idx+8)
        mesh('City_'+family+'_Stone_'+profile,a,stone,col,g,'Stone');mesh('City_'+family+'_Windows_'+profile,e,windows,col,g,'Windows');atlas_mesh('City_'+family+'_Atlas_'+profile,p,atlas,col,g)
    root['familyCount']=14;s['description']='Fourteen original city families, with balconies, civic gables, rooftop gardens and angled skyline crowns.'
    print(json.dumps({'profile':profile,'families':root['familyCount'],'triangles':sum(sum(len(q.vertices)-2 for q in o.data.polygons) for o in col.objects if o.type=='MESH')}))
