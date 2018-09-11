import { JIRA_BACKLOG, JIRA_USERS, JIRA_SPRINT, JIRA_ASSIGN_TICKET, JIRA_UNASSIGN_TICKET } from '../actions/action_jira'
import * as _ from 'lodash'
import { Member } from '../entities/member'
import { Ticket } from '../entities/ticket'

export default function (state = {
    backlog: null,
    sprint: [],
    users: null
}, action) {

    switch (action.type) {
        case JIRA_BACKLOG.RESPONSE:
            return {
                ...state,
                backlog: action.backlog.map(x => new Ticket(x))
            }
        case JIRA_SPRINT.RESPONSE:
            return interpolateAndSort({
                ...state,
                sprint: constructTickets(action.sprint)
            })
        case JIRA_USERS.RESPONSE:
            return interpolateAndSort({
                ...state,
                users: action.users.map(x => new Member(x))
            })
        case JIRA_ASSIGN_TICKET.RESPONSE:
            return {
                ...state,
                backlog: state.backlog ? state.backlog.filter(x => x.key !== action.payload.ticketId) : null,
                sprint: addTicketToUserSprint(action.payload.ticketId, action.payload.user.emailAddress, state)
            }
        case JIRA_UNASSIGN_TICKET.RESPONSE:
            return {
                ...state,
                backlog: moveTicketToBacklog(action.payload.ticketId, state),
                sprint: removeTicketFromSprint(action.payload.ticketId, state)
            }
        default:
            return state
    }
}

function interpolateAndSort(state) {
    if (!state.sprint || !state.users) {
        return state;
    }

    return {
        ...state,
        users: _(state.users)
            .map(user => ({
                ...user,
                storyPoints: _(state.sprint)
                    .filter(issue => issue.assignee === user.emailAddress)
                    .sumBy(s => _.sumBy(s.issues, "storyPoints"))
            }))
            .orderBy("storyPoints")
            .value()
    }
}

function constructTickets(issueData) {
    return _(issueData)
        .filter(x => x.fields.assignee != null)
        .map(x => new Ticket(x))
        .groupBy("assignee.emailAddress")
        .map((issues, assignee) => {
            return {
                assignee,
                issues
            }
        })
        .value()
}

function addTicketToUserSprint(ticketId, userId, state) {
    const ticketInSprint = getTicketFromSprint(state, ticketId)
    if (ticketInSprint && ticketInSprint.assignee === userId) {
        return state.sprint
    }
    if (state.backlog && state.backlog.find(t => t.key === ticketId) !== undefined) {
        return moveFromBacklogToSprint(ticketId, userId, state)
    } else {
        return moveFromUserToUser(ticketId, userId, state)
    }
}

function moveFromUserToUser(ticketId, userId, state) {
    var dragSource = getTicketFromSprint(state, ticketId)
    const dragSourceAssignee = dragSource.assignee
    const ticketToMove = dragSource.issues.find(x => x.key === ticketId)

    const newSprint = state.sprint.map(x => {
        if (x.assignee === dragSourceAssignee) {
            return {
                ...x,
                issues: x.issues.filter(i => i.key !== ticketId)
            }
        }
        if (x.assignee === userId) {
            return {
                ...x,
                issues: [
                    ticketToMove,
                    ...x.issues
                ]
            }
        }
        return x
    })

    return addUserToSprintIfNecessary(state, userId, ticketId, newSprint, [ticketToMove])
}

function moveFromBacklogToSprint(ticketId, userId, state) {

    const newSprint = state.sprint.map(x => {
        if (x.assignee === userId) {
            return {
                ...x,
                issues: [
                    state.backlog.filter(t => t.key === ticketId)[0],
                    ...x.issues
                ]
            }
        } else {
            return x
        }
    })
    const userIssues = state.backlog.filter(t => t.key === ticketId)
    return addUserToSprintIfNecessary(state, userId, ticketId, newSprint, userIssues)
}

function addUserToSprintIfNecessary(state, userId, ticketId, newSprint, userIssues) {

    const addUserToSprint = state.sprint.find(x => x.assignee === userId) === undefined

    return addUserToSprint
        ? [
            {
                assignee: userId,
                issues: userIssues
            },
            ...newSprint
        ]
        : newSprint
}

function getTicketFromSprint(state, ticketId) {
    return state.sprint.find(x => x.issues.find(i => i.key === ticketId))
}

function removeTicketFromSprint(ticketId, state) {
    var dragSource = getTicketFromSprint(state, ticketId)
    const dragSourceAssignee = dragSource.assignee

    return state.sprint.map(sprintItem => {
        if (sprintItem.assignee === dragSourceAssignee) {
            return {
                ...sprintItem,
                issues: sprintItem.issues.filter(i => i.key !== ticketId)
            }
        }
        return sprintItem
    })
}

function moveTicketToBacklog(ticketId, state) {
    var dragSource = getTicketFromSprint(state, ticketId)
    const ticketToMove = dragSource.issues.find(x => x.key === ticketId)
    return [
        ticketToMove,
        ...state.backlog
    ]
}