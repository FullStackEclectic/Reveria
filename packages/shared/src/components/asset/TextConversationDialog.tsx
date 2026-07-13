import { useMemo, useState } from "react";
import { Bot, Check, Copy, Trash2, X } from "lucide-react";
import { AssetSummary } from "../../types";
import { assetTextContent, getAssetMetadata } from "../../utils";
import "./TextConversationDialog.css";

export type TextConversation = {
  id: string;
  title: string;
  assets: AssetSummary[];
};

interface TextConversationDialogProps {
  conversation: TextConversation;
  onClose: () => void;
  onDelete: (conversation: TextConversation) => Promise<void>;
}

function conversationTranscript(conversation: TextConversation) {
  return conversation.assets
    .flatMap((asset) => {
      const meta = getAssetMetadata(asset);
      const prompt = typeof meta.prompt === "string" ? meta.prompt.trim() : "";
      const output = assetTextContent(asset);
      return [prompt ? `用户：${prompt}` : "", output ? `AI：${output}` : ""].filter(Boolean);
    })
    .join("\n\n");
}

export function TextConversationDialog({
  conversation,
  onClose,
  onDelete,
}: TextConversationDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const transcript = useMemo(() => conversationTranscript(conversation), [conversation]);

  async function copyConversation() {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      alert(`复制对话失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function deleteConversation() {
    const turnLabel = conversation.assets.length > 1 ? `及其中 ${conversation.assets.length} 轮内容` : "";
    if (!window.confirm(`确定删除这段对话${turnLabel}吗？`)) return;
    setIsDeleting(true);
    try {
      await onDelete(conversation);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="text-conversation-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-label="文本对话预览"
        className="text-conversation-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="text-conversation-header">
          <div>
            <span className="text-conversation-eyebrow"><Bot size={14} />AI 对话</span>
            <h3>{conversation.title}</h3>
            <p>{conversation.assets.length} 轮问答</p>
          </div>
          <button type="button" onClick={onClose} title="关闭">
            <X size={17} />
          </button>
        </header>

        <div className="text-conversation-transcript">
          {conversation.assets.map((asset, index) => {
            const meta = getAssetMetadata(asset);
            const prompt = typeof meta.prompt === "string" ? meta.prompt.trim() : "";
            const output = assetTextContent(asset);
            const model = typeof meta.model === "string" ? meta.model : "AI";
            return (
              <section className="text-conversation-turn" key={asset.id}>
                <div className="text-conversation-message user">
                  <span>你 · 第 {index + 1} 轮</span>
                  <p>{prompt || "未记录本轮提问"}</p>
                </div>
                <div className="text-conversation-message assistant">
                  <span><Bot size={13} />{model}</span>
                  <p>{output || "未记录本轮回复"}</p>
                </div>
              </section>
            );
          })}
        </div>

        <footer className="text-conversation-actions">
          <button className="danger" type="button" onClick={() => void deleteConversation()} disabled={isDeleting}>
            <Trash2 size={15} />{isDeleting ? "删除中" : "删除对话"}
          </button>
          <button type="button" onClick={() => void copyConversation()} disabled={!transcript}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "已复制" : "复制对话"}
          </button>
          <button className="primary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>
  );
}
