"""Helpers for MCP to import read-only extracted game meshes into the studio.
Call build_character(record, offset) with scripts/chibi-scale-study.ts JSON data.
This is a scale and attachment study, not an integrated game screenshot.
"""
import bpy, json
RESET_ROSTER=True
s=bpy.data.scenes['Kitsu_Chibi_Naruto_Review'];bpy.context.window.scene=s
name='Kitsu_Chibi_Naruto_RosterStudy'
old=bpy.data.collections.get(name)
if old and RESET_ROSTER:
    for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(old);old=None
roster=old or bpy.data.collections.new(name)
if not old:s.collection.children.link(roster)
def build_character(record,offset):
    for i,source in enumerate(record['meshes']):
        d=bpy.data.meshes.new('Chibi_Study_'+record['name']+'_'+str(i))
        verts=[(p[0],-p[2],p[1]) for p in source['vertices']]
        ids=source['indices'];d.from_pydata(verts,[],[tuple(ids[k:k+3]) for k in range(0,len(ids),3)]);d.update()
        o=bpy.data.objects.new(d.name,d);roster.objects.link(o);o.location.x=offset
        o['studySource']='Unchanged existing game createHead('+record['id']+')'
        m=bpy.data.materials.new(d.name);m.use_nodes=True;m.diffuse_color=(*source['color'],1)
        n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        n.inputs[0].default_value=(*source['color'],1);n.inputs[2].default_value=.83;n.inputs[14].default_value=.12
        if source['colors']:
            attr=d.color_attributes.new(name='GameColor',type='FLOAT_COLOR',domain='POINT')
            for j,color in enumerate(source['colors']):attr.data[j].color=(*color,1)
            color_node=m.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='GameColor'
            m.node_tree.links.new(color_node.outputs[0],n.inputs[0])
        d.materials.append(m)
        for p in d.polygons:p.use_smooth=True
    print('Existing character added at matching scale:',record['name'])
