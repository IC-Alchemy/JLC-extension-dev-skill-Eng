const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  buildGraph,
  loadContext,
  loadGraph,
} = require('./eda-api');

function optionalTypeScript() {
  try {
    return require('typescript');
  }
  catch {
    return null;
  }
}

test('fixture graph preserves overloads, inheritance, unions, enums, and visibility rules', (t) => {
  const ts = optionalTypeScript();
  if (!ts) {
    t.skip('typescript is not installed in this development checkout');
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eda-api-fixture-'));
  const declarationPath = path.join(dir, 'index.d.ts');
  fs.writeFileSync(declarationPath, `
declare global {
  /** @public */
  enum EFixture_Mode {
    A = "a",
    B = "b"
  }

  /** @public */
  interface IBaseShape {
    id: string;
  }

  /** @beta */
  interface IShape extends IBaseShape {
    mode: EFixture_Mode;
  }

  type TShape = IShape | undefined;

  /** @public */
  class Sample {
    private secret: string;
    /** @internal */
    internalOnly(): void;
    /** @alpha */
    overloaded(value: string): Promise<IShape>;
    overloaded(value: number, mode?: EFixture_Mode): Promise<TShape>;
    shared(): string;
  }

  class Sample2 {
    shared(): string;
    onlySecond(): boolean;
  }

  class EDA {
    sample: Sample | Sample2;
  }
}
export {};
`, 'utf8');

  const graph = buildGraph({
    ts,
    declarationPath,
    apiPackageVersion: 'fixture',
    declarationHash: 'fixture-hash',
    typescriptVersion: ts.version,
  });

  assert.equal(graph.classes.Sample.members.secret, undefined);
  assert.equal(graph.classes.Sample.members.internalOnly, undefined);
  assert.equal(graph.classes.Sample.members.overloaded.declarations.length, 2);
  assert.equal(graph.interfaces.IShape.baseTypes[0], 'IBaseShape');
  assert.deepEqual(graph.mounts.sample.variants, ['Sample', 'Sample2']);
  assert.deepEqual(graph.mounts.sample.commonMembers, ['shared']);
  assert.deepEqual(graph.enums.EFixture_Mode.members.map(member => member.name), ['A', 'B']);
  assert.equal(graph.typeAliases.TShape.unionTypes.length, 2);
  assert.ok(graph.classes.Sample.members.overloaded.declarations[0].warnings[0].includes('@alpha'));
});

test('real pro-api-types 0.2.58 integration exposes new mounts, union mount, and overloads', (t) => {
  let ctx;
  try {
    ctx = loadContext(process.cwd());
  }
  catch {
    t.skip('target SDK dependencies are not installed in this development checkout');
    return;
  }

  const graph = loadGraph(ctx);

  assert.equal(graph.meta.packageVersion, '0.2.58');
  assert.equal(Object.keys(graph.classes).length, 127);
  assert.equal(Object.keys(graph.interfaces).length, 129);
  assert.equal(Object.keys(graph.enums).length, 70);
  assert.equal(Object.keys(graph.typeAliases).length, 31);

  for (const mount of ['dmt_Event', 'pcb_RayTracerEngine', 'sch_Net', 'sch_PrimitiveObject']) {
    assert.ok(graph.mounts[mount], `${mount} should exist`);
  }

  assert.deepEqual(graph.mounts.sch_PrimitiveComponent.variants, ['SCH_PrimitiveComponent', 'SCH_PrimitiveComponent3']);
  assert.ok(graph.mounts.sch_PrimitiveComponent.commonMembers.includes('get'));
  assert.ok(graph.classes.LIB_Device.members.getByLcscIds.declarations.length >= 2);
});
