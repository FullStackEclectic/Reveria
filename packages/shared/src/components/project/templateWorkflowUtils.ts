import { PromptTemplate, AssetSummary, ProjectCanvasDocument } from "../../types";
import { postJson, getJson, assetTitle } from "../../utils";

interface GenerateParams {
  template: PromptTemplate;
  payload: { prompt: string; negative_prompt: string; ratio: string; ref_image_url: string | null };
  workspaceId: string;
  projectId: string;
  customerId: string | null | undefined;
  currentUserId: string | null | undefined;
  panX: number;
  panY: number;
  activeBoardId: string;
  itemsCount: number;
  createCanvasItemId: () => string;
  setProjectCanvas: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  setAssets?: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  showToast: (msg: string) => void;
  pushToHistory: (canvas: ProjectCanvasDocument) => void;
  projectCanvas: ProjectCanvasDocument;
}

export async function runTemplateGeneration({
  template,
  payload,
  workspaceId,
  projectId,
  customerId,
  currentUserId,
  panX,
  panY,
  activeBoardId,
  itemsCount,
  createCanvasItemId,
  setProjectCanvas,
  setAssets,
  showToast,
  pushToHistory,
  projectCanvas,
}: GenerateParams) {
  // 1. 根据 ratio 判断尺寸
  let w = 220;
  let h = 140;
  const ratio = payload.ratio;
  if (ratio.includes("1:1")) {
    w = 180; h = 180;
  } else if (ratio.includes("9:16")) {
    w = 140; h = 248;
  } else if (ratio.includes("3:4")) {
    w = 150; h = 200;
  } else if (ratio.includes("4:3")) {
    w = 200; h = 150;
  } else if (ratio.includes("16:9")) {
    w = 248; h = 140;
  }

  // 2. 先往画布添加一个占位卡片
  const placeholderId = createCanvasItemId();
  
  pushToHistory(projectCanvas);
  setProjectCanvas((current) => ({
    ...current,
    version: 1,
    items: [
      ...current.items,
      {
        id: placeholderId,
        type: "note",
        title: `✨ 正在生成 ${template.title}...`,
        text: `提示词: ${payload.prompt}\n\n正在拼命生成中，请稍候...`,
        x: Math.round(-panX + 100 + (itemsCount % 4) * 40),
        y: Math.round(-panY + 100 + (itemsCount % 5) * 30),
        w,
        h,
        board_id: activeBoardId,
      },
    ],
  }));

  showToast(`“${template.title}”任务已提交，正在生成中...`);

  // 3. 发起请求
  const workflowType = template.workflow_type || "image-generation";
  let apiUrl = "/api/tasks";
  let postData: any = {
    workspace_id: workspaceId,
    project_id: projectId,
  };

  // 映射 size
  let sizeStr = "1024x1024";
  if (ratio.includes("9:16")) sizeStr = "768x1344";
  else if (ratio.includes("16:9")) sizeStr = "1344x768";
  else if (ratio.includes("3:4")) sizeStr = "768x1024";
  else if (ratio.includes("4:3")) sizeStr = "1024x768";

  const selectedModel = template.model_id || (
    (workflowType === "image-generation" || workflowType === "image-to-image") ? "gpt-image-2" :
    (workflowType === "video-generation") ? "luma-video" : "gpt-4o"
  );

  // 解析高级生成参数
  let advParams: any = {};
  try {
    if (template.advanced_params) {
      advParams = JSON.parse(template.advanced_params);
    }
  } catch (e) {
    console.error("解析模板高级参数失败:", e);
  }

  // 优先采用高级参数中设定的宽高
  const sizePayload = (advParams.width && advParams.height) 
    ? `${advParams.width}x${advParams.height}` 
    : sizeStr;

  if (workflowType === "image-generation" || workflowType === "image-to-image") {
    postData = {
      ...postData,
      task_type: "image_generation",
      selected_model: selectedModel,
      input_payload: {
        prompt: payload.prompt,
        negative_prompt: payload.negative_prompt || template.negative_prompt || "",
        size: sizePayload,
        quality: "medium",
        image_count: 1,
        ref_image_url: payload.ref_image_url,
        // 透传高级生成参数
        steps: advParams.steps ?? 28,
        cfg_scale: advParams.cfg_scale ?? 7.0,
        denoising_strength: advParams.denoising_strength ?? 0.5,
        sampler: advParams.sampler ?? "euler",
        scheduler: advParams.scheduler ?? "normal",
        vae: advParams.vae || "automatic",
        seed: advParams.seed !== undefined && advParams.seed !== -1 ? advParams.seed : undefined,
        loras: advParams.loras || [],
        embeddings: advParams.embeddings || [],
        controlnets: advParams.controlnets || [],
        clip_skip: advParams.clip_skip ?? 2,
        ensd: advParams.ensd ?? 13337,
        detail_enhancement: !!advParams.detail_enhancement
      }
    };
  } else if (workflowType === "video-generation") {
    postData = {
      ...postData,
      task_type: "video_generation",
      selected_model: selectedModel,
      input_payload: {
        prompt: payload.prompt,
        negative_prompt: payload.negative_prompt || template.negative_prompt || "",
        size: sizePayload,
        ref_image_url: payload.ref_image_url,
        // 透传高级生成参数
        steps: advParams.steps ?? 28,
        cfg_scale: advParams.cfg_scale ?? 7.0,
        denoising_strength: advParams.denoising_strength ?? 0.5,
        sampler: advParams.sampler ?? "euler",
        scheduler: advParams.scheduler ?? "normal",
        vae: advParams.vae || "automatic",
        seed: advParams.seed !== undefined && advParams.seed !== -1 ? advParams.seed : undefined,
        loras: advParams.loras || [],
        embeddings: advParams.embeddings || [],
        controlnets: advParams.controlnets || [],
        clip_skip: advParams.clip_skip ?? 2,
        ensd: advParams.ensd ?? 13337,
        detail_enhancement: !!advParams.detail_enhancement
      }
    };
  } else if (workflowType === "text-generation") {
    postData = {
      ...postData,
      task_type: "text",
      selected_model: selectedModel,
      input_payload: {
        prompt: payload.prompt,
        steps: advParams.steps ?? 28,
        cfg_scale: advParams.cfg_scale ?? 7.0,
      }
    };
  } else {
    apiUrl = `/api/workflows/${workflowType}`;
    postData = {
      ...postData,
      brief: payload.prompt,
    };
  }

  try {
    const response = await postJson<any>(apiUrl, postData);
    if (response && response.success !== false) {
      const task = response.task || response.data;
      if (response.asset) {
        const asset: AssetSummary = response.asset;
        if (setAssets) {
          setAssets((curr) => [asset, ...curr]);
        }
        setProjectCanvas((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === placeholderId
              ? {
                  id: placeholderId,
                  type: "asset",
                  asset_id: asset.id,
                  title: assetTitle(asset) || template.title,
                  x: item.x,
                  y: item.y,
                  w: item.w,
                  h: item.h,
                  board_id: item.board_id,
                }
              : item
          ),
        }));
        showToast(`“${template.title}”生成成功！`);
      } else if (response.output) {
        const outputText = typeof response.output === "string" 
          ? response.output 
          : typeof response.output.summary === "string"
          ? response.output.summary
          : JSON.stringify(response.output, null, 2);

        setProjectCanvas((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === placeholderId
              ? {
                  ...item,
                  title: template.title,
                  text: outputText,
                }
              : item
          ),
        }));
        showToast(`“${template.title}”创意生成成功！`);
      } else if (task && task.id) {
        const taskId = task.id;
        
        const pollInterval = setInterval(async () => {
          try {
            const taskRes = await getJson<{ success: boolean; data: any }>(`/api/tasks/${taskId}`);
            if (taskRes.success && taskRes.data) {
              const taskStatus = taskRes.data.status;
              if (taskStatus === "succeeded") {
                clearInterval(pollInterval);
                const assetsRes = await getJson<{ success: boolean; data: AssetSummary[] }>(
                  `/api/projects/${projectId}/assets`
                );
                if (assetsRes.success && assetsRes.data.length > 0) {
                  const latestAsset = assetsRes.data[0];
                  if (setAssets) {
                    setAssets(assetsRes.data);
                  }
                  setProjectCanvas((current) => ({
                    ...current,
                    items: current.items.map((item) =>
                      item.id === placeholderId
                        ? {
                            id: placeholderId,
                            type: "asset",
                            asset_id: latestAsset.id,
                            title: assetTitle(latestAsset) || template.title,
                            x: item.x,
                            y: item.y,
                            w: item.w,
                            h: item.h,
                            board_id: item.board_id,
                          }
                        : item
                    ),
                  }));
                }
                showToast(`“${template.title}”生成完毕！`);
              } else if (taskStatus === "failed") {
                clearInterval(pollInterval);
                setProjectCanvas((current) => ({
                  ...current,
                  items: current.items.map((item) =>
                    item.id === placeholderId
                      ? {
                          ...item,
                          title: `❌ ${template.title} 生成失败`,
                          text: `错误信息: ${taskRes.data.error_message || "未知服务商内部错误"}`,
                        }
                      : item
                  ),
                }));
                showToast("任务生成失败");
              }
            }
          } catch (err) {
            console.error("轮询任务状态失败:", err);
          }
        }, 3000);

        setTimeout(() => {
          clearInterval(pollInterval);
        }, 120000);
      }
    } else {
      throw new Error("接口返回失败");
    }
  } catch (err: any) {
    console.error("模板直接生成失败:", err);
    setProjectCanvas((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === placeholderId
          ? {
              ...item,
              title: `❌ ${template.title} 生成出错`,
              text: `生成时发生错误，请重试。\n具体原因: ${err.message || err}`,
            }
          : item
      ),
    }));
    showToast("任务提交失败，请检查积分余额或输入");
  }
}
