import type { InstructionSet } from '../../../rendering/renderers/shared/instructions/InstructionSet';
import type { InstructionPipe, RenderPipe } from '../../../rendering/renderers/shared/instructions/RenderPipe';
import type { Renderable } from '../../../rendering/renderers/shared/Renderable';
import type { Renderer, RenderPipes } from '../../../rendering/renderers/types';
import type { Container } from '../Container';
import type { RenderGroup } from '../RenderGroup';

export function buildInstructions(renderGroup: RenderGroup, renderer: Renderer)
{
    const root = renderGroup.root;
    const instructionSet = renderGroup.instructionSet;

    instructionSet.reset();

    const renderPipes = renderer.renderPipes as RenderPipes;

    // TODO add some events / runners for build start
    renderPipes.batch.buildStart(instructionSet);
    renderPipes.blendMode.buildStart();
    renderPipes.colorMask.buildStart();

    if (root.sortableChildren)
    {
        root.sortChildren();
    }

    collectAllRenderablesAdvanced(root, instructionSet, renderer, true);

    // instructionSet.log();
    // TODO add some events / runners for build end
    renderPipes.batch.buildEnd(instructionSet);
    renderPipes.blendMode.buildEnd(instructionSet);

    // instructionSet.log();
}

export function collectAllRenderables(
    container: Container,
    instructionSet: InstructionSet,
    renderer: Renderer
): void
{
    // if there is 0b01 or 0b10 the return value

    if (container.globalDisplayStatus < 0b111 || !container.includeInBuild) return;

    if (container.sortableChildren)
    {
        container.sortChildren();
    }

    if (container.isSimple)
    {
        collectAllRenderablesSimple(container, instructionSet, renderer);
    }
    else
    {
        collectAllRenderablesAdvanced(container, instructionSet, renderer, false);
    }
}

function collectAllRenderablesSimple(
    container: Container,
    instructionSet: InstructionSet,
    renderer: Renderer,
): void
{
    if (container.renderPipeId)
    {
        const { renderPipes, renderableGC } = renderer;

        // TODO add blends in
        renderPipes.blendMode.setBlendMode(container as Renderable, container.groupBlendMode, instructionSet);

        container.didViewUpdate = false;

        const rp = renderPipes as unknown as Record<string, RenderPipe>;

        rp[container.renderPipeId].addRenderable(container as Renderable, instructionSet);

        renderableGC.addRenderable(container as Renderable, instructionSet);
    }

    if (!container.renderGroup)
    {
        const children = container.children;
        const length = children.length;

        for (let i = 0; i < length; i++)
        {
            collectAllRenderables(children[i], instructionSet, renderer);
        }
    }
}

function collectAllRenderablesAdvanced(
    container: Container,
    instructionSet: InstructionSet,
    renderer: Renderer,
    isRoot: boolean
): void
{
    const { renderPipes, renderableGC } = renderer;

    if (!isRoot && container.renderGroup)
    {
        renderPipes.renderGroup.addRenderGroup(container.renderGroup, instructionSet);
    }
    else
    {
        for (let i = 0; i < container.effects.length; i++)
        {
            const effect = container.effects[i];
            const pipe = renderPipes[effect.pipe as keyof RenderPipes]as InstructionPipe<any>;

            pipe.push(effect, container, instructionSet);
        }

        const renderPipeId = container.renderPipeId;

        if (renderPipeId)
        {
            // TODO add blends in
            renderPipes.blendMode.setBlendMode(container as Renderable, container.groupBlendMode, instructionSet);
            container.didViewUpdate = false;

            const pipe = renderPipes[renderPipeId as keyof RenderPipes]as RenderPipe<any>;

            pipe.addRenderable(container, instructionSet);

            renderableGC.addRenderable(container as Renderable, instructionSet);
        }

        const children = container.children;

        if (children.length)
        {
            for (let i = 0; i < children.length; i++)
            {
                collectAllRenderables(children[i], instructionSet, renderer);
            }
        }

        // loop backwards through effects
        for (let i = container.effects.length - 1; i >= 0; i--)
        {
            const effect = container.effects[i];
            const pipe = renderPipes[effect.pipe as keyof RenderPipes]as InstructionPipe<any>;

            pipe.pop(effect, container, instructionSet);
        }
    }
}

