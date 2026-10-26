import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { AlterarAluno } from '../aplicacao/alterar-aluno.js';
import { BuscarAluno } from '../aplicacao/buscar-aluno.js';
import { CriarAluno } from '../aplicacao/criar-aluno.js';
import { ListarAlunos, type FiltroDeSituacao } from '../aplicacao/listar-alunos.js';
import { ListarTurmas } from '../aplicacao/listar-turmas.js';
import { AlterarAlunoDto, AlunoDto, CriarAlunoDto, ListaDeAlunosDto, ListaDeTurmasDto } from './alunos.dto.js';

const SITUACOES: FiltroDeSituacao[] = ['ativos', 'inativos', 'todos'];

// Id da URL precisa ser um uuid; se não for, responde 400 com mensagem em português.
const ID_DO_ALUNO = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Aluno não encontrado. Volte à lista e escolha outro cadastro.'),
});

// [Cadastros.RF001] Qualquer usuário autenticado (administrativo ou diretoria) mantém alunos.
@ApiTags('alunos')
@ApiCookieAuth('cookie')
@Controller('alunos')
export class AlunosController {
  constructor(
    private readonly listarAlunos: ListarAlunos,
    private readonly buscarAluno: BuscarAluno,
    private readonly criarAluno: CriarAluno,
    private readonly alterarAluno: AlterarAluno,
  ) {}

  // O operationId vira o nome do hook gerado no frontend: useListarAlunos().
  @Get()
  @ApiOperation({ operationId: 'listarAlunos', summary: 'Lista os alunos (por padrão, só os ativos)' })
  @ApiQuery({ name: 'situacao', enum: SITUACOES, required: false })
  @ApiOkResponse({ type: ListaDeAlunosDto })
  async listar(@Query('situacao') situacao?: string): Promise<ListaDeAlunosDto> {
    const filtro = SITUACOES.find((permitida) => permitida === situacao);
    if (situacao !== undefined && filtro === undefined) {
      throw new BadRequestException('Use situacao=ativos, inativos ou todos.');
    }
    return { itens: await this.listarAlunos.executar(filtro) };
  }

  @Get(':id')
  @ApiOperation({ operationId: 'buscarAluno', summary: 'Abre o cadastro de um aluno' })
  @ApiOkResponse({ type: AlunoDto })
  buscar(@Param('id', ID_DO_ALUNO) id: string): Promise<AlunoDto> {
    return this.buscarAluno.executar(id);
  }

  @Post()
  @ApiOperation({ operationId: 'criarAluno', summary: 'Inclui um aluno' })
  @ApiCreatedResponse({ type: AlunoDto })
  criar(@Body() dto: CriarAlunoDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<AlunoDto> {
    return this.criarAluno.executar(dto ?? {}, autor.id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'alterarAluno', summary: 'Altera, inativa ou reativa um aluno' })
  @ApiOkResponse({ type: AlunoDto })
  alterar(
    @Param('id', ID_DO_ALUNO) id: string,
    @Body() dto: AlterarAlunoDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<AlunoDto> {
    return this.alterarAluno.executar(id, dto ?? {}, autor.id);
  }
}

@ApiTags('alunos')
@ApiCookieAuth('cookie')
@Controller('turmas')
export class TurmasController {
  constructor(private readonly listarTurmas: ListarTurmas) {}

  @Get()
  @ApiOperation({ operationId: 'listarTurmas', summary: 'Lista as turmas já cadastradas' })
  @ApiOkResponse({ type: ListaDeTurmasDto })
  async listar(): Promise<ListaDeTurmasDto> {
    return { itens: await this.listarTurmas.executar() };
  }
}
