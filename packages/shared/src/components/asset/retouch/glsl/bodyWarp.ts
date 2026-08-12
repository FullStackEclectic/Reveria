/**
 * 全身塑形坐标变换。
 *
 * 通过主体中心与腰线定位建立连续的分区形变，所有区域都使用高斯权重平滑过渡，
 * 避免肩、腰、胯、腿之间出现硬折线。正值语义：瘦腰、宽肩、丰胯、瘦腿、长腿。
 */
export const GLSL_BODY_WARP = `
  vec2 applyBodyWarp(vec2 coord, float aspect) {
    float centerX = u_body_center_x * 0.01;
    float waistY = u_body_waist_y * 0.01;
    float shoulderY = clamp(waistY - 0.24, 0.12, 0.48);
    float hipY = clamp(waistY + 0.17, 0.42, 0.78);
    float legY = clamp(hipY + 0.20, 0.62, 0.92);

    float shoulderMask = exp(-pow((coord.y - shoulderY) / 0.16, 2.0));
    float waistMask = exp(-pow((coord.y - waistY) / 0.14, 2.0));
    float hipMask = exp(-pow((coord.y - hipY) / 0.15, 2.0));
    float legMask = exp(-pow((coord.y - legY) / 0.23, 2.0));

    float horizontalScale = 1.0;
    horizontalScale += u_body_waist * 0.0022 * waistMask;
    horizontalScale -= u_body_shoulders * 0.0018 * shoulderMask;
    horizontalScale -= u_body_hips * 0.0018 * hipMask;
    horizontalScale += u_body_legs * 0.0018 * legMask;

    float deltaX = (coord.x - centerX) * aspect;
    coord.x = centerX + deltaX * horizontalScale / aspect;

    float lowerBody = smoothstep(hipY - 0.05, hipY + 0.08, coord.y);
    float lengthScale = 1.0 - u_body_leg_length * 0.0018 * lowerBody;
    coord.y = hipY + (coord.y - hipY) * lengthScale;
    return coord;
  }
`;
