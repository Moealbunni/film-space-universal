"""Import a Film Space Universal camera path into Blender.

Set PATH_FILE to the exported JSON file. Run from Blender's Scripting workspace.
"""

import json
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

PATH_FILE = Path(r"C:\path\to\film-space-camera-path.json")

data = json.loads(PATH_FILE.read_text(encoding="utf-8"))
if data.get("format") != "film-space-camera-path-v1":
    raise ValueError("Not a Film Space Universal camera path")

samples = data.get("samples", [])
if not samples:
    raise ValueError("The camera path has no samples")

camera_data = bpy.data.cameras.new("Film Space Camera")
camera_object = bpy.data.objects.new("Film Space Camera", camera_data)
bpy.context.collection.objects.link(camera_object)
bpy.context.scene.camera = camera_object
bpy.context.scene.render.fps = int(data.get("fps", 60))
camera_object.rotation_mode = "QUATERNION"

# Three.js: +Y up, camera looks toward -Z.
# Blender: +Z up, camera looks toward local -Z.
axis_change = Matrix.Rotation(1.5707963267948966, 4, "X")

for sample in samples:
    frame = round(float(sample["time"]) * bpy.context.scene.render.fps) + 1
    x, y, z = sample["position"]
    camera_object.location = axis_change @ Vector((x, y, z))
    qx, qy, qz, qw = sample["quaternion"]
    three_rotation = Quaternion((qw, qx, qy, qz)).to_matrix().to_4x4()
    camera_object.rotation_quaternion = (axis_change @ three_rotation).to_quaternion()
    camera_data.lens = float(sample.get("lensMm", 35))
    camera_object.keyframe_insert(data_path="location", frame=frame)
    camera_object.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    camera_data.keyframe_insert(data_path="lens", frame=frame)

bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = round(float(samples[-1]["time"]) * bpy.context.scene.render.fps) + 1
print(f"Imported {len(samples)} Film Space camera samples")
