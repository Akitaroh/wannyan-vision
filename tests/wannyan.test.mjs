import test from 'node:test';
import assert from 'node:assert/strict';
import {transformPixels,fittedSize} from '../public/vision.js';
test('linear sRGB endpoint fixtures, not a gamma-space multiplication',()=>{
  const input=Uint8ClampedArray.from([255,0,0,255,0,255,0,255,0,0,255,255,128,64,32,77]);
  assert.deepEqual([...transformPixels(input)],[163,144,0,255,239,214,58,255,0,61,251,255,97,87,31,77]);
  assert.equal(input[0],255);
});
test('all neutral grays and alpha are preserved',()=>{
  const pixels=Uint8ClampedArray.from(Array.from({length:256},(_,n)=>[n,n,n,n]).flat());
  assert.deepEqual(transformPixels(pixels),pixels);
});
test('bounds, source integrity, and aspect-preserving memory limit',()=>{
  assert.deepEqual(fittedSize(4032,3024),{width:1600,height:1200});
  assert.deepEqual(fittedSize(3024,4032),{width:1200,height:1600});
  assert.deepEqual(fittedSize(300,400),{width:300,height:400});
  assert.throws(()=>fittedSize(0,40));
  assert.throws(()=>transformPixels([0,1]));
  const values=Uint8ClampedArray.from(Array.from({length:4096},(_,i)=>(i*137)%256));
  const original=values.slice();
  const converted=transformPixels(values);
  assert.deepEqual(values,original);
  for(let i=3;i<converted.length;i+=4) assert.equal(converted[i],values[i]);
});
