"""Which frame an animation shows and how far it is nudged. Pure.

Ports of motionOffset and frameAt in js/sprite-render.js.
"""


def motion_offset(motion, step):
    if step % 2 == 0:
        return {"dx": 0, "dy": 0}
    if motion == "bob":
        return {"dx": 0, "dy": -1}
    if motion == "hop":
        return {"dx": 0, "dy": -2}
    if motion == "shake":
        return {"dx": -1, "dy": 0}
    return {"dx": 0, "dy": 0}


def frame_at(animation, step, still=False):
    """The frame and offset an animation shows at a step counted from its start."""
    seq = animation["seq"]
    if still:
        return {"frame": seq[0], "dx": 0, "dy": 0}
    return {"frame": seq[step % len(seq)], **motion_offset(animation["motion"], step)}
