from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.nodes import (
    AgentNodeResult,
    approval_gate,
    check_safety,
    plan_action_card,
    retrieve_evidence,
    triage,
)
from app.agents.runtime import (
    AgentWorkflowResult,
    list_referenced_evidence_items,
    run_node as run_agent_node,
    to_trace_step,
)
from app.agents.state import AgentState
from app.schemas import (
    ActionCard,
    AgentRunGenerationMode,
    EvidenceItem,
    InboxItem,
)
from app.schemas.agent_route import AgentRoute
from app.settings import Settings


class GraphWorkflowState(TypedDict):
    agent_state: AgentState
    node_results: list[tuple[AgentNodeResult, int]]


TERMINAL_TRIAGE_ROUTES = frozenset(
    {
        AgentRoute.IGNORE,
        AgentRoute.MISSING_INFO,
    }
)

SKIP_PLANNING_AFTER_RETRIEVAL_ROUTES = frozenset(
    {
        AgentRoute.CONFLICTING_EVIDENCE,
        AgentRoute.LOW_RISK_TODO,
    }
)


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

    referenced_evidence_items = list_referenced_evidence_items(
        action_card=state.action_card,
        evidence_items=evidence_items,
    )
    return AgentWorkflowResult(
        action_card=state.action_card,
        agent_steps=[
            to_trace_step(
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
    graph_builder.add_node("safety", _safety_node_runner())
    graph_builder.add_node("approval_gate", _node_runner(approval_gate))
    graph_builder.add_edge(START, "triage")
    graph_builder.add_conditional_edges(
        "triage",
        _next_after_triage,
        {
            "continue": "retrieval",
            "skip_to_safety": "safety",
        },
    )
    graph_builder.add_conditional_edges(
        "retrieval",
        _next_after_retrieval,
        {
            "continue": "planning",
            "skip_to_safety": "safety",
        },
    )
    graph_builder.add_edge("planning", "safety")
    graph_builder.add_edge("safety", "approval_gate")
    graph_builder.add_edge("approval_gate", END)
    return graph_builder.compile()


def _next_after_triage(graph_state: GraphWorkflowState) -> str:
    if graph_state["agent_state"].route in TERMINAL_TRIAGE_ROUTES:
        return "skip_to_safety"
    return "continue"


def _next_after_retrieval(graph_state: GraphWorkflowState) -> str:
    if graph_state["agent_state"].route in SKIP_PLANNING_AFTER_RETRIEVAL_ROUTES:
        return "skip_to_safety"
    return "continue"


def _node_runner(node):
    def run_graph_node(graph_state: GraphWorkflowState) -> GraphWorkflowState:
        agent_state = graph_state["agent_state"]
        node_result = run_agent_node(agent_state, node)
        return GraphWorkflowState(
            agent_state=agent_state,
            node_results=[*graph_state["node_results"], node_result],
        )

    return run_graph_node


def _safety_node_runner():
    def run_safety_node(graph_state: GraphWorkflowState) -> GraphWorkflowState:
        agent_state = graph_state["agent_state"]
        if agent_state.action_card is None:
            agent_state.action_card = agent_state.template_action_card
            agent_state.generation_mode = AgentRunGenerationMode.DETERMINISTIC_TEMPLATE
            agent_state.fallback_reason = (
                f"Graph route skipped planning for {agent_state.route.value}"
                if agent_state.route
                else "Graph route skipped planning"
            )

        node_result = run_agent_node(agent_state, check_safety)
        return GraphWorkflowState(
            agent_state=agent_state,
            node_results=[*graph_state["node_results"], node_result],
        )

    return run_safety_node
