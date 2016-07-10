{
  get_enabled_goals
  get_goals
} = require 'libs_backend/goal_utils'

{memoizeSingleAsync} = require 'libs_common/memoize'

{
  gexport
  gexport_module
} = require 'libs_common/gexport'

{cfy} = require 'cfy'

measurement_functions = require 'goals/progress_measurement'
measurement_functions_generated = require 'goals/progress_measurement_generated'

export get_progress_measurement_functions = memoizeSingleAsync cfy ->*
  output = {}
  goals = yield get_goals()
  for goal_name,goal_info of goals
    if goal_info.measurement?
      measurement_function = measurement_functions[goal_info.measurement]
      if measurement_function?
        output[goal_name] = measurement_function(goal_info)
        continue
    measurement_function = measurement_functions_generated[goal_name]
    if measurement_function?
      output[goal_name] = measurement_function(goal_info)
      continue
    console.log "no measurement found for goal #{goal_name}"
  return output

export get_progress_measurement_function_for_goal_name = cfy (goal_name) ->*
  progress_measurement_functions = yield get_progress_measurement_functions()
  return progress_measurement_functions[goal_name]

export get_progress_on_goal_today = cfy (goal_name) ->*
  yield get_progress_on_goal_days_since_today goal_name, 0

export get_progress_on_goal_this_week = cfy (goal_name) ->*
  results = []
  for days_since_today from 0 to 6
    progress_info = yield get_progress_on_goal_days_since_today goal_name, days_since_today
    results.push progress_info
  return results

export get_progress_on_enabled_goals_today = cfy ->*
  yield get_progress_on_enabled_goals_days_since_today 0

export get_progress_on_goal_days_since_today = cfy (goal_name, days_since_today) ->*
  goal_measurement_function = yield get_progress_measurement_function_for_goal_name goal_name
  yield goal_measurement_function days_since_today

export get_progress_on_enabled_goals_days_since_today = cfy (days_since_today) ->*
  enabled_goals = yield get_enabled_goals()
  enabled_goals_list = Object.keys enabled_goals
  output = {}
  for goal_name in enabled_goals_list
    progress_info = yield get_progress_on_goal_days_since_today goal_name, days_since_today
    output[goal_name] = progress_info
  return output

gexport_module 'goal_progress', -> eval(it)