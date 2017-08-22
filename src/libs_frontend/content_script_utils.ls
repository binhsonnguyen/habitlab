send_message_to_background = (type, data) ->
  return new Promise (resolve, reject) ->
    chrome.runtime.sendMessage {
      type
      data
    }, (result) ->
      resolve(result)
    return true

export load_css_file = (filename) ->>
  await send_message_to_background 'load_css_file', {css_file: filename}
  return

export load_css_code = (css_code) ->>
  await send_message_to_background 'load_css_code', {css_code: css_code}
  return
