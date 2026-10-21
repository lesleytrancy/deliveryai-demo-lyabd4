export function Empty({ text = '暂无数据' }: { text?: string }) {
  return <div className="text-center text-slate-400 py-12 text-sm">{text}</div>
}
