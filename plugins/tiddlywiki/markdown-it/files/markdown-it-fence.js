(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.markdownitfence = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

module.exports = function fence_plugin(md, name, opts) {
  function defaultValidate(params) {
    return params.trim().split(' ', 2)[0] === name
  }

  function defaultRender(tokens, idx, _options, env, self) {
    if (tokens[idx].nesting === 1) {
      tokens[idx].attrPush(['class', name])
    }

    return self.renderToken(tokens, idx, _options, env, self)
  }

  const options = Object.assign({
    validate: defaultValidate,
    render: defaultRender
  }, opts)

  function fence(state, startLine, endLine) {
    let marker = options.marker || '`'
    let pos = state.bMarks[startLine] + state.tShift[startLine]
    let max = state.eMarks[startLine]
    let haveEndMarker = false

    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    if (pos + 3 > max) return false

    marker = state.src.charCodeAt(pos)

    let mem = pos
    pos = state.skipChars(pos, marker)
    let len = pos - mem

    if (len < 3) return false

    const markup = state.src.slice(mem, pos)
    const params = state.src.slice(pos, max)

    if (params.indexOf(String.fromCharCode(marker)) >= 0) return false

    let nextLine = startLine

    for (;;) {
      nextLine++
      if (nextLine >= endLine) break

      pos = mem = state.bMarks[nextLine] + state.tShift[nextLine]
      max = state.eMarks[nextLine]

      if (pos < max && state.sCount[nextLine] < state.blkIndent) break
      if (state.src.charCodeAt(pos) !== marker) continue
      if (state.sCount[nextLine] - state.blkIndent >= 4) continue

      pos = state.skipChars(pos, marker)

      if (pos - mem < len) continue

      pos = state.skipSpaces(pos)

      if (pos < max) continue

      haveEndMarker = true

      break
    }

    len = state.sCount[startLine]
    state.line = nextLine + (haveEndMarker ? 1 : 0)

    let token
    if (options.validate(params)) token = state.push(name, 'div', 0)
    else token = state.push('fence', 'code', 0)
    token.info = params
    token.content = state.getLines(startLine + 1, nextLine, len, true)
    token.markup = markup
    token.map = [startLine, state.line]

    return true
  }

  md.block.ruler.before('fence', name, fence, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']})
  md.renderer.rules[name] = options.render
}

},{}]},{},[1])(1)
});