// 教材图库匹配（figures.js）单元测试：用注入的文件列表，不依赖真实图片文件
import test from 'node:test';
import assert from 'node:assert/strict';
import { findFigure } from '../src/figures.js';

const FILES = ['位错.png', '铁碳相图.png'];

test('命中概念的句子返回对应教材图', () => {
  assert.equal(findFigure('位错沿滑移面运动', { files: FILES }), '位错.png');
  assert.equal(findFigure('铁碳相图分析珠光体', { files: FILES }), '铁碳相图.png');
});

test('概念关键词直接出现时优先命中', () => {
  assert.equal(findFigure('铁碳相图的杠杆定律', { files: FILES }), '铁碳相图.png');
});

test('未命中返回 null', () => {
  assert.equal(findFigure('今天天气很好', { files: FILES }), null);
});

test('概念无配图时即使术语匹配也返回 null', () => {
  assert.equal(findFigure('均匀形核与非均匀形核', { files: ['位错.png'] }), null);
});

test('无任何图时返回 null', () => {
  assert.equal(findFigure('位错', { files: [] }), null);
});
