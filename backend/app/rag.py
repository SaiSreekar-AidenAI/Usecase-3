def build_rag_context(sources: list[dict]) -> str:
    if not sources:
        return "No reference responses found."

    lines = ["Here are relevant reference responses from the knowledge base:\n"]
    for i, src in enumerate(sources, 1):
        lines.append(f"--- Reference {i} (Relevance: {src['relevance_score']:.2f}) ---")
        lines.append(f"Category: {src['category']}")
        lines.append(f"Description: {src['description']}")
        lines.append(f"Response: {src['response']}")
        lines.append("")

    return "\n".join(lines)
