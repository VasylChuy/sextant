import { combineReducers } from 'redux';
import calendarActions from './reducer_calendar';
import teamActions from './reducer_team';
import memberActions from './reducer_member';
import eventActions from './reducer_event';

const rootReducer = combineReducers({
    calendar: calendarActions,
    team: teamActions,
    memberCurrentlyBeingEdited: memberActions,
    eventCurrentlyBeingEdited: eventActions,
});

export default rootReducer;
 