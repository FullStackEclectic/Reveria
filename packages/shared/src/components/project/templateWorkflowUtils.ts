import { PromptTemplate, AssetSummary, ProjectCanvasDocument, CanvasItem, TemplateGenerationPayload } from "../../types";
import { postJson, putJson, getJson, assetTitle, getAssetMetadata } from "../../utils";
import { parseTemplateExecutionConfig } from "../../templateExecution";

interface GenerateParams {
  template: PromptTemplate;
  payload: TemplateGenerationPayload;
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
  // 本次生成的占位卡 ID，同时用作「文档是否仍属于本次生成」的判据（见 updatePlaceholder）。
  const placeholderId = createCanvasItemId();

  // 自动同步画布到后端，防止刷新丢卡片。
  // 必须接收「完整文档」而不是只接收 items：后端是整体覆盖式 upsert，
  // 且文档必须来自 setProjectCanvas 的 current，不能用函数入口处捕获的闭包快照，
  // 否则生成期间用户的任何编辑（新卡片、新画板、新连线）都会被旧快照覆盖。
  let lastSavedPayload = "";
  const saveCanvasDoc = async (doc: ProjectCanvasDocument) => {
    const payload = JSON.stringify({ ...doc, version: 1 });
    if (lastSavedPayload === payload) return;
    lastSavedPayload = payload;
    try {
      await putJson(`/api/projects/${projectId}/canvas`, { canvas: JSON.parse(payload) });
    } catch (e) {
      lastSavedPayload = "";
      console.error("[runTemplateGeneration] 自动同步画布失败:", e);
    }
  };

  /**
   * 在最新文档上更新占位卡片。
   *
   * 占位卡是否还在 current.items 里，同时充当「这份文档是否仍属于本次生成」的判据：
   * 用户切到别的项目后，全局 projectCanvas 已经换成另一个项目的文档，占位卡自然不在其中，
   * 此时必须整体放弃——否则会把另一个项目的卡片 PUT 进本项目的画布 URL，造成跨项目覆盖。
   * 用户手动删掉占位卡时同样应当放弃。
   */
  const updatePlaceholder = (
    transform: (item: CanvasItem) => CanvasItem,
    options: { persist: boolean } = { persist: true }
  ) => {
    setProjectCanvas((current) => {
      if (!current.items.some((item) => item.id === placeholderId)) {
        return current;
      }
      const nextDoc: ProjectCanvasDocument = {
        ...current,
        version: 1,
        items: current.items.map((item) => (item.id === placeholderId ? transform(item) : item)),
      };
      if (options.persist) {
        void saveCanvasDoc(nextDoc);
      }
      return nextDoc;
    });
  };

  // 1. 智能提取选定分辨率或从 ratio 推导初始大小，使占位符比例与真图 100% 保持一致
  let w = 320;
  let h = 320;
  const ratio = payload.ratio;
  
  // 优先提取高级生成参数中设定的分辨率大小
  let targetWidth = 1024;
  let targetHeight = 1024;
  try {
    if (template.advanced_params) {
      const adv = JSON.parse(template.advanced_params);
      if (adv.width) targetWidth = adv.width;
      if (adv.height) targetHeight = adv.height;
    }
  } catch (e) {}

  // 限制最大边为 320 像素，另一边根据原始比例等比例缩放
  const maxCanvasSide = 320;
  if (targetWidth === targetHeight) {
    w = maxCanvasSide;
    h = maxCanvasSide;
  } else if (targetWidth > targetHeight) {
    w = maxCanvasSide;
    h = Math.round(maxCanvasSide * (targetHeight / targetWidth));
  } else {
    h = maxCanvasSide;
    w = Math.round(maxCanvasSide * (targetWidth / targetHeight));
  }

  // 备用 fallback: 如果无法解析，则使用 ratio 字符串的模糊匹配
  if (!targetWidth || !targetHeight) {
    if (ratio.includes("1:1")) {
      w = 320; h = 320;
    } else if (ratio.includes("9:16")) {
      w = 220; h = 390;
    } else if (ratio.includes("16:9")) {
      w = 390; h = 220;
    } else if (ratio.includes("3:4")) {
      w = 260; h = 345;
    } else if (ratio.includes("4:3")) {
      w = 345; h = 260;
    }
  }

  // 2. 先往画布添加一个占位卡片
  pushToHistory(projectCanvas);

  const placeholderItem: CanvasItem = {
    id: placeholderId,
    type: "note" as const,
    title: `正在生成 ${template.title}...`,
    text: `提示词: ${payload.prompt}\n\n正在拼命生成中，请稍候...`,
    x: Math.round(-panX + 100 + (itemsCount % 4) * 40),
    y: Math.round(-panY + 100 + (itemsCount % 5) * 30),
    w,
    h,
    board_id: activeBoardId,
  };

  // 基于 current 追加，避免覆盖掉提交瞬间之后产生的其它编辑。
  setProjectCanvas((current) => {
    const nextDoc: ProjectCanvasDocument = {
      ...current,
      version: 1,
      items: [...current.items, placeholderItem],
    };
    // 立即自动保存占位卡片状态到数据库，确保刷新不丢失
    void saveCanvasDoc(nextDoc);
    return nextDoc;
  });

  showToast(`“${template.title}”任务已提交，正在生成中...`);

  // 3. 发起请求
  const workflowType = template.workflow_type || "image-generation";
  const executionConfig = payload.execution_config || parseTemplateExecutionConfig(template);
  const runtimeScenes = executionConfig.output_mode === "scenes" ? payload.scenes : [];
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
        image_count: executionConfig.output_mode === "scenes"
          ? runtimeScenes.length
          : executionConfig.output_mode === "variants"
            ? Math.max(1, Math.min(advParams.image_count ?? 2, executionConfig.max_outputs))
            : 1,
        operation: executionConfig.operation,
        output_mode: executionConfig.output_mode,
        scenes: runtimeScenes,
        ref_image_url: payload.ref_image_url,
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
        
        updatePlaceholder((item) => ({
          id: placeholderId,
          type: "asset" as const,
          asset_id: asset.id,
          title: assetTitle(asset) || template.title,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          board_id: item.board_id,
        }));
        showToast(`“${template.title}”生成成功！`);
      } else if (response.output) {
        const outputText = typeof response.output === "string" 
          ? response.output 
          : typeof response.output.summary === "string"
          ? response.output.summary
          : JSON.stringify(response.output, null, 2);

        updatePlaceholder((item) => ({
          ...item,
          title: template.title,
          text: outputText,
        }));
        showToast(`\u201c${template.title}\u201d创意生成成功！`);
      } else if (task && task.id) {
        const taskId = task.id;
        
        // 绑定 task_id 并持久化保存到后端
        updatePlaceholder((item) => ({ ...item, task_id: taskId }));

        const pollInterval = setInterval(async () => {
          try {
            const res = await getJson<any>(`/api/tasks/${taskId}`);
            const taskData = (res && typeof res.success === "boolean" && res.data) ? res.data : res;
            if (taskData) {
              const taskStatus = taskData.status;
              if (taskStatus === "succeeded") {
                clearInterval(pollInterval);
                const assetsRes = await getJson<AssetSummary[] | { success: boolean; data: AssetSummary[] }>(
                  `/api/assets?project_id=${encodeURIComponent(projectId)}`
                );
                
                let assetsData: AssetSummary[] = [];
                if (Array.isArray(assetsRes)) {
                  assetsData = assetsRes;
                } else if (assetsRes && typeof assetsRes === "object" && Array.isArray((assetsRes as any).data)) {
                  assetsData = (assetsRes as any).data;
                }

                if (assetsData.length > 0) {
                  if (setAssets) {
                    setAssets(assetsData);
                  }

                  // 必须按 task_id 精确匹配本次任务的产物。
                  // 素材列表按 created_at desc 排序，取 assetsData[0] 会在以下场景绑错图：
                  //   - 生成期间用户手动上传了新素材
                  //   - 同时有多个生成任务在轮询，它们会全部绑到同一张图
                  const generated = assetsData
                    .filter((asset) => asset.task_id === taskId)
                    .sort((a, b) => (a.output_index ?? 0) - (b.output_index ?? 0));
                  const producedAsset = generated[0];

                  if (producedAsset) {
                    updatePlaceholder((item) => ({
                      id: placeholderId,
                      type: "asset" as const,
                      asset_id: producedAsset.id,
                      title: assetTitle(producedAsset) || template.title,
                      x: item.x,
                      y: item.y,
                      w: item.w,
                      h: item.h,
                      board_id: item.board_id,
                    }));
                  } else {
                    // 任务已成功但产物尚未入库或未回填 task_id，如实告知而不是随便绑一张图
                    updatePlaceholder((item) => ({
                      ...item,
                      title: `${template.title} 结果待同步`,
                      text: "任务已完成，但未能定位到本次生成的图片。请刷新素材库后查看。",
                    }));
                  }
                }
                showToast(`\u201c${template.title}\u201d生成完毕！`);
              } else if (taskStatus === "failed") {
                clearInterval(pollInterval);
                
                updatePlaceholder((item) => ({
                  ...item,
                  title: `${template.title} 生成失败`,
                  text: `错误信息: ${taskData.error_message || "未知服务商内部错误"}`,
                }));
                showToast("任务生成失败");
              } else if (taskStatus === "running") {
                // 从 output_payload 中读取实时进度文本并更新占位卡片
                let progressText = "AI 正在生成中，请耐心等待...";
                try {
                  const outputPayload = typeof taskData.output_payload === "string"
                    ? JSON.parse(taskData.output_payload)
                    : taskData.output_payload;
                  if (outputPayload?.progress_text) {
                    progressText = outputPayload.progress_text;
                  }
                } catch (_e) { /* ignore parse error */ }

                // 进度文本变化频繁，只更新内存不落库，避免高频 PUT
                updatePlaceholder(
                  (item) => ({ ...item, text: `提示词: ${payload.prompt}\n\n${progressText}` }),
                  { persist: false }
                );
              }
            }
          } catch (err) {
            console.error("轮询任务状态失败:", err);
          }
        }, 3000);

        setTimeout(() => {
          clearInterval(pollInterval);
        }, 600000);  // 多图生成可能需要较长时间，总超时 10 分钟
      }

    } else {
      throw new Error("接口返回失败");
    }
  } catch (err: any) {
    console.error("模板直接生成失败:", err);
    
    updatePlaceholder((item) => ({
      ...item,
      title: `${template.title} 生成出错`,
      text: `生成时发生错误，请重试。\n具体原因: ${err.message || err}`,
    }));
    showToast("任务提交失败，请检查积分余额或输入");
  }
}
