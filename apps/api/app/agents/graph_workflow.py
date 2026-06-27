from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.nodes import (
    AgentNodeResult,
    check_safety,
    plan_action_card,
    retrieve_evidence,
    triage,
)
from app.agents.state import AgentState
from app.agents.workflow import (
    AgentWorkflowResult,
    _list_referenced_evidence_items,
    _run_node,
    _to_trace_step,
)
from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    EvidenceItem,
    InboxItem,
)
from app.settings import Settings


class GraphWorkflowState(TypedDict):
    agent_state: AgentState
    node_results: list[tuple[AgentNodeResult, int]]


def run_agent_graph_workflow(
    *,
    inbox_item: InboxItem,
    template_action_card: ActionCard,
    evidence_items: tuple[EvidenceItem, ...],
    settings: Settings,
) -> AgentWorkflowResult:
    graph = _build_graph()
    initial_state = GraphWorkflowState(
        agent_state=AgentState(
            inbox_item=inbox_item,
            template_action_card=template_action_card,
            all_evidence_items=evidence_items,
            settings=settings,
        ),
        node_results=[],
    )
    graph_result = graph.invoke(initial_state)
    state = graph_result["agent_state"]
    node_results = graph_result["node_results"]

    if state.action_card is None:
        state.action_card = template_action_card
        state.generation_mode = AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
        state.fallback_reason = "Agent graph workflow did not produce an Action Card"

    referenced_evidence_items = _list_referenced_evidence_items(
        action_card=state.action_card,
        evidence_items=evidence_items,
    )
    return AgentWorkflowResult(
        action_card=state.action_card,
        agent_steps=[
            _to_trace_step(
                action_card_id=state.action_card.id,
                sequence=sequence,
                node_result=node_result,
            )
            for sequence, node_result in enumerate(node_results, start=1)
        ],
        evidence_items=list(referenced_evidence_items),
        generation_mode=state.generation_mode,
        fallback_reason=state.fallback_reason,
        route=state.route,
    )


def _build_graph():
    graph_builder = StateGraph(GraphWorkflowState)
    graph_builder.add_node("triage", _node_runner(triage))
    graph_builder.add_node("retrieval", _node_runner(retrieve_evidence))
    graph_builder.add_node("planning", _node_runner(plan_action_card))
    graph_builder.add_node("safety", _node_runner(check_safety))
    graph_builder.add_edge(START, "triage")
    graph_builder.add_edge("triage", "retrieval")
    graph_builder.add_edge("retrieval", "planning")
    graph_builder.add_edge("planning", "safety")
    graph_builder.add_edge("safety", END)
    return graph_builder.compile()


def _node_runner(node):
    def run_node(graph_state: GraphWorkflowState) -> GraphWorkflowState:
        agent_state = graph_state["agent_state"]
        node_result = _run_node(agent_state, node)
        return GraphWorkflowState(
            agent_state=agent_state,
            node_results=[*graph_state["node_results"], node_result],
        )

    return run_node
