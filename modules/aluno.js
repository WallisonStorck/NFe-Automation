// aluno.js (Funções auxiliares para processar campos específicos)
import { CONFIG } from "../config.js";
import { logger } from "../modules/logger.js";
import { MENSAGENS } from "./mensagens.js";

export async function inserirDataEmissao(page) {
  if (CONFIG.DATA_EMISSAO_MANUAL) {
    logger.info(
      `🗓️ Alterando data de emissão para: ${CONFIG.DATA_EMISSAO_MANUAL}`,
    );
    await page.waitForSelector(
      "#formEmissaoNFConvencional\\:imDataEmissao_input",
      { visible: true },
    );
    await page.click("#formEmissaoNFConvencional\\:imDataEmissao_input", {
      clickCount: 3,
    });
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");
    await page.type(
      "#formEmissaoNFConvencional\\:imDataEmissao_input",
      CONFIG.DATA_EMISSAO_MANUAL,
    );
    await page.keyboard.press("Tab");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (CONFIG.VERBOSE) {
      logger.info(
        `✅ Data de emissão alterada para: ${CONFIG.DATA_EMISSAO_MANUAL}`,
      );
    }
  }
}

export async function selecionarTipoPessoa(page) {
  if (CONFIG.VERBOSE) {
    logger.info("🔄 Selecionando Tipo de Pessoa...");
  }

  const LABEL_SEL =
    "#formEmissaoNFConvencional\\:groupDadosTomador\\:j_idt533_label";
  const INPUT_SEL =
    "#formEmissaoNFConvencional\\:groupDadosTomador\\:j_idt533_input";

  try {
    // 1) Aguarda o label visível
    await page.waitForSelector(LABEL_SEL, { visible: true, timeout: 30000 });

    // 2) Rola até o elemento
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: "center" });
    }, LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3) Verifica se já está como Física (evita clique desnecessário)
    const labelAtual = await page.evaluate(
      (sel) => document.querySelector(sel)?.textContent?.trim() || "",
      LABEL_SEL,
    );

    if (
      labelAtual.toLowerCase().includes("física") ||
      labelAtual.toLowerCase().includes("fisica")
    ) {
      if (CONFIG.VERBOSE) {
        logger.info("✅ Tipo de pessoa já está como Física, pulando seleção.");
      }
      return;
    }

    // 4) Tenta manipular o <select> oculto diretamente via JS
    const selecionadoViaDom = await page.evaluate((inputSel) => {
      const select = document.querySelector(inputSel);
      if (!select) return false;
      const option = Array.from(select.options).find(
        (o) =>
          o.value === "FISICA" ||
          (o.textContent || "").toLowerCase().includes("física") ||
          (o.textContent || "").toLowerCase().includes("fisica"),
      );
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, INPUT_SEL);

    if (selecionadoViaDom) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (CONFIG.VERBOSE) {
        logger.info("✅ Tipo de pessoa definido como Física (via DOM)");
      }
      return;
    }

    // 5) Fallback: clica no label para abrir o dropdown e clica na opção
    await page.click(LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const clicou = await page.evaluate(() => {
      const items = document.querySelectorAll("li.ui-selectonemenu-item");
      for (const item of items) {
        const texto = (item.textContent || "").toLowerCase();
        if (texto.includes("física") || texto.includes("fisica")) {
          item.click();
          return true;
        }
      }
      const roleItems = document.querySelectorAll("[role='option']");
      for (const item of roleItems) {
        const texto = (item.textContent || "").toLowerCase();
        if (texto.includes("física") || texto.includes("fisica")) {
          item.click();
          return true;
        }
      }
      return false;
    });

    if (!clicou) {
      throw new Error(
        "Opção 'Física' não encontrada no dropdown de Tipo de Pessoa.",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (CONFIG.VERBOSE) {
      logger.info("✅ Tipo de pessoa definido como Física");
    }
  } catch (error) {
    logger.error("❌ Erro ao selecionar o tipo de pessoa:", error.message);
    throw error;
  }
}

export async function inserirCPF(page, cpf) {
  const CPF_SEL = "#formEmissaoNFConvencional\\:groupDadosTomador\\:j_idt544";
  const NOME_SEL = "#formEmissaoNFConvencional\\:groupDadosTomador\\:razaoNome";

  try {
    // Aguarda o campo CPF ficar visível no DOM (só existe quando tipo=Física)
    // Timeout maior pois depende do AJAX de selecionarTipoPessoa terminar
    await page.waitForSelector(CPF_SEL, {
      visible: true,
      timeout: 15000,
    });

    // Buffer adicional — garante que o campo está estável após re-render do PrimeFaces
    await new Promise((resolve) => setTimeout(resolve, 500));

    let tentativas = 0;
    let nameFilledIn = "";

    while (tentativas < CONFIG.MAX_TENTATIVAS_CPF) {
      tentativas++;

      // A partir da tentativa 2: se j_idt544 sumiu do DOM, significa que o
      // PrimeFaces re-renderizou o form após encontrar o aluno — sucesso real
      if (tentativas > 1) {
        const cpfFieldExists = await page.evaluate(
          (sel) => !!document.querySelector(sel),
          CPF_SEL,
        );
        if (!cpfFieldExists) {
          logger.info(
            "Cadastro encontrado (formulario re-renderizado pelo PrimeFaces).",
          );
          return;
        }
      }

      // Usa page.evaluate para focus+select — evita race condition com
      // elemento recem-renderizado que ainda pode estar sendo reattached ao DOM
      await page.evaluate((sel) => {
        const input = document.querySelector(sel);
        if (!input) throw new Error("Campo CPF nao encontrado: " + sel);
        input.focus();
        input.select();
      }, CPF_SEL);

      await page.keyboard.press("Backspace");
      await page.keyboard.press("Delete");

      await page
        .waitForFunction(
          (sel) => {
            const input = document.querySelector(sel);
            return input && input.value.trim() === "";
          },
          { timeout: 4000 },
          CPF_SEL,
        )
        .catch(() => {});

      for (let char of cpf) {
        await page.type(CPF_SEL, char, { delay: 200 });
      }

      await page.keyboard.press("Tab");
      logger.info(
        `⏳ Buscando cadastro... [Tentativa ${tentativas}/${CONFIG.MAX_TENTATIVAS_CPF}]`,
      );

      await new Promise((resolve) => setTimeout(resolve, 6000));

      nameFilledIn = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        // PrimeFaces pode armazenar o valor em .value, textContent ou innerText
        return (
          el?.value?.trim() ||
          el?.textContent?.trim() ||
          el?.innerText?.trim() ||
          ""
        );
      }, NOME_SEL);

      if (nameFilledIn && nameFilledIn.trim() !== "") {
        if (CONFIG.VERBOSE) {
          logger.info("✅ CPF inserido corretamente.");
        }
        return;
      }
    }

    throw new Error(
      `Falha ao inserir CPF ${cpf} após ${tentativas} tentativas. Talvez o aluno não esteja cadastrado... Pulando para o próximo...`,
    );
  } catch (error) {
    logger.error(`❌ ${error.message}`);
    throw error;
  }
}

export async function inserirAtividadeMunicipal(page) {
  logger.info("⏳ Inserindo Atividade Municipal...");

  // ⚠️ Aqui está o campo REAL (select oculto)
  const SELECT_SEL = "#formEmissaoNFConvencional\\:listaAtvAtd_input";
  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaAtvAtd_label";

  const TEXTO_ALVO = "080102 - Ensino regular superior.";
  const CODIGO_ALVO = "080102";

  // 1) Espera o select existir
  await page.waitForSelector(SELECT_SEL, { visible: true, timeout: 30000 });

  // 2) Espera a opção do código aparecer (porque depende do CNAE)
  if (CONFIG.VERBOSE) {
    logger.info(
      "⏳ Aguardando opções da Atividade Municipal carregarem (dependente do CNAE)...",
    );
  }
  await page.waitForFunction(
    (sel, codigo) => {
      const select = document.querySelector(sel);
      if (!select) return false;
      const options = Array.from(select.querySelectorAll("option"));
      return options.some((op) => (op.textContent || "").includes(codigo));
    },
    { timeout: 30000 },
    SELECT_SEL,
    CODIGO_ALVO,
  );

  // 3) Descobre o value exato da opção 080102 e seleciona
  const valueAlvo = await page.evaluate(
    (sel, texto) => {
      const select = document.querySelector(sel);
      const options = Array.from(select.querySelectorAll("option"));
      const opt = options.find((o) => (o.textContent || "").trim() === texto);
      return opt ? opt.value : null;
    },
    SELECT_SEL,
    TEXTO_ALVO,
  );

  if (!valueAlvo) {
    throw new Error(
      `Não encontrou a opção "${TEXTO_ALVO}" no select de Atividade Municipal.`,
    );
  }

  if (CONFIG.VERBOSE) {
    logger.info(`🔎 Value encontrado para "${TEXTO_ALVO}": ${valueAlvo}`);
  }

  // 4) Seleciona no select (isso dispara change no Puppeteer)
  await page.select(SELECT_SEL, valueAlvo);

  // 5) PrimeFaces às vezes precisa de blur/tab para processar
  await page.focus(SELECT_SEL).catch(() => {});
  await page.keyboard.press("Tab");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 6) Confirma se o label atualizou
  let atividadePreenchida = await page.evaluate((sel) => {
    return document.querySelector(sel)?.textContent?.trim() || "";
  }, LABEL_SEL);

  if (CONFIG.VERBOSE) {
    logger.info(
      `🔎 Atividade Municipal atual: "${atividadePreenchida || "[vazio]"}"`,
    );
  }

  // 7) Se o label não atualizou ainda, espera mais um pouco (ajax)
  if (!atividadePreenchida.includes(CODIGO_ALVO)) {
    logger.warn(
      "⏳ Atividade Municipal ainda não refletiu no label. Aguardando processamento...",
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));

    atividadePreenchida = await page.evaluate((sel) => {
      return document.querySelector(sel)?.textContent?.trim() || "";
    }, LABEL_SEL);
  }

  if (!atividadePreenchida.includes(CODIGO_ALVO)) {
    throw new Error(
      `Falha ao selecionar Atividade Municipal. Label permaneceu: "${
        atividadePreenchida || "[vazio]"
      }"`,
    );
  }

  if (CONFIG.VERBOSE) {
    logger.info("✅ Atividade Municipal inserida com sucesso!");
  }
}

export async function inserirNBS(page) {
  logger.info("⏳ Inserindo NBS...");

  const SELECT_SEL = "#formEmissaoNFConvencional\\:listaNBS_input";
  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaNBS_label";
  const NEXT_SELECT_SEL = "#formEmissaoNFConvencional\\:listaIndOp_input";

  const VALUE_ALVO = "122041000";
  const TEXTO_ALVO = "122041000 - Serviços educacionais de graduação";

  try {
    // 1) Espera o select existir
    await page.waitForSelector(SELECT_SEL, { timeout: 30000 });

    // 2) Espera a opção correta existir
    await page.waitForFunction(
      (sel, value) => {
        const select = document.querySelector(sel);
        if (!select) return false;
        return Array.from(select.options).some((opt) => opt.value === value);
      },
      { timeout: 30000 },
      SELECT_SEL,
      VALUE_ALVO,
    );

    // 3) Aplica o valor e força o onchange do PrimeFaces
    await page.evaluate(
      ({ selectSel, labelSel, valueAlvo, textoAlvo }) => {
        const select = document.querySelector(selectSel);
        const label = document.querySelector(labelSel);

        if (!select) {
          throw new Error("Select de NBS não encontrado.");
        }

        select.value = valueAlvo;

        if (label) {
          label.textContent = textoAlvo;
        }

        if (typeof select.onchange === "function") {
          select.onchange();
        }

        select.dispatchEvent(new Event("change", { bubbles: true }));
      },
      {
        selectSel: SELECT_SEL,
        labelSel: LABEL_SEL,
        valueAlvo: VALUE_ALVO,
        textoAlvo: TEXTO_ALVO,
      },
    );

    // 4) Aguarda o AJAX terminar — espera listaIndOp ter mais de 1 opção carregada
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        if (!select) return false;
        return select.options.length > 1;
      },
      { timeout: 15000 },
      NEXT_SELECT_SEL,
    );

    // 5) Aguarda estabilizar antes de avançar
    await new Promise((resolve) => setTimeout(resolve, 1500));

    logger.info("✅ NBS inserido com sucesso!");
  } catch (error) {
    logger.error(`❌ Erro ao inserir NBS: ${error.message}`);
    throw error;
  }
}

export async function inserirCodigoIndicadorOperacao(page) {
  logger.info("⏳ Inserindo Código Indicador da Operação...");

  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaIndOp_label";
  const NEXT_SELECT_SEL = "#formEmissaoNFConvencional\\:listaClassTrib_input";
  const VALUE_ALVO = "030101";

  try {
    // 1) Garante que o label está visível e rola até ele
    await page.waitForSelector(LABEL_SEL, { visible: true, timeout: 15000 });
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: "center" });
    }, LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2) Clica no label para abrir o dropdown
    await page.click(LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3) Clica na opção correta
    const clicou = await page.evaluate((value) => {
      const liItems = document.querySelectorAll("li.ui-selectonemenu-item");
      for (const item of liItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      const trItems = document.querySelectorAll(
        ".ui-selectonemenu-items-wrapper tr",
      );
      for (const item of trItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      const roleItems = document.querySelectorAll("[role='option']");
      for (const item of roleItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      return false;
    }, VALUE_ALVO);

    if (!clicou) {
      throw new Error(
        `Opção ${VALUE_ALVO} não encontrada na lista do dropdown.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4) Aguarda o próximo campo ter opções (AJAX)
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        return select && select.options.length > 1;
      },
      { timeout: 20000 },
      NEXT_SELECT_SEL,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info("✅ Código Indicador da Operação inserido com sucesso!");
  } catch (error) {
    logger.error(
      `❌ Erro ao inserir Código Indicador da Operação: ${error.message}`,
    );
    throw error;
  }
}

export async function inserirClassificacaoTributaria(page) {
  logger.info("⏳ Inserindo Classificação Tributária...");

  const LABEL_SEL = "#formEmissaoNFConvencional\\:listaClassTrib_label";
  const VALUE_ALVO = "200028";

  try {
    // 1) Garante que o label está visível e rola até ele
    await page.waitForSelector(LABEL_SEL, { visible: true, timeout: 15000 });
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: "center" });
    }, LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2) Clica no label para abrir o dropdown
    await page.click(LABEL_SEL);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3) Clica na opção correta
    const clicou = await page.evaluate((value) => {
      const liItems = document.querySelectorAll("li.ui-selectonemenu-item");
      for (const item of liItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      const trItems = document.querySelectorAll(
        ".ui-selectonemenu-items-wrapper tr",
      );
      for (const item of trItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      const roleItems = document.querySelectorAll("[role='option']");
      for (const item of roleItems) {
        if (item.textContent?.includes(value)) {
          item.click();
          return true;
        }
      }

      return false;
    }, VALUE_ALVO);

    if (!clicou) {
      throw new Error(
        `Opção ${VALUE_ALVO} não encontrada na lista do dropdown.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4) Aguarda label confirmar seleção
    await page.waitForFunction(
      (sel, value) => {
        return document.querySelector(sel)?.textContent?.includes(value);
      },
      { timeout: 15000 },
      LABEL_SEL,
      VALUE_ALVO,
    );

    logger.info("✅ Classificação Tributária inserida com sucesso!");
  } catch (error) {
    logger.error(
      `❌ Erro ao inserir Classificação Tributária: ${error.message}`,
    );
    throw error;
  }
}

export async function inserirMensagem(page, aluno) {
  logger.info(`💬 Inserindo mensagem...`);
  let dataEmissaoFinal = CONFIG.DATA_EMISSAO_MANUAL;

  if (!dataEmissaoFinal) {
    dataEmissaoFinal = await page.evaluate(() => {
      let dataInput = document.querySelector(
        "#formEmissaoNFConvencional\\:imDataEmissao_input",
      );
      return dataInput ? dataInput.value : "";
    });
  }

  if (!dataEmissaoFinal || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataEmissaoFinal)) {
    logger.error(
      "❌ Erro ao obter a data de emissão. Verifique o campo de data.",
    );
    return;
  }

  const [dia, mes, ano] = dataEmissaoFinal.split("/");
  if (CONFIG.DATA_EMISSAO_MANUAL != "") {
    logger.info(`✅ Data de emissão confirmada: ${dataEmissaoFinal}`);
  }

  const CodServico = parseInt(aluno.CODSERVICO, 10);
  let mensagemTemplate = MENSAGENS[CodServico] || MENSAGENS.default;

  let mensagem = mensagemTemplate
    .replace("{curso}", aluno.CURSO)
    .replace("{mes}", mes)
    .replace("{ano}", ano);

  await page.click("#formEmissaoNFConvencional\\:descricaoItem", {
    clickCount: 3,
  });
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await page.type("#formEmissaoNFConvencional\\:descricaoItem", mensagem);

  if (CONFIG.VERBOSE) {
    logger.info(`✅ Mensagem inserida: "${mensagem}"`);
  }
}

export async function inserirValor(page, aluno) {
  const valorNumerico =
    typeof aluno?.__VALOR_NUM === "number" ? aluno.__VALOR_NUM : NaN;

  if (Number.isNaN(valorNumerico)) {
    logger.error(
      `❌ Valor inválido ou não detectado para ${aluno.ALUNO}. Coluna detectada: "${aluno.__COLUNA_VALOR || "?"}" | Bruto: "${aluno.__VALOR_BRUTO || ""}"`,
    );

    return false;
  }

  if (valorNumerico === 0) {
    logger.warn(
      `⚠️ Valor da nota para o aluno ${aluno.ALUNO} é R$ 0,00. Pulando emissão.`,
    );
    return false;
  }

  const valorFormatado = valorNumerico.toFixed(2).replace(".", ",");

  await page.click("#formEmissaoNFConvencional\\:vlrUnitario_input", {
    clickCount: 3,
  });
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");

  for (let char of valorFormatado) {
    await page.type("#formEmissaoNFConvencional\\:vlrUnitario_input", char, {
      delay: 150,
    });
  }

  logger.info(`💵 Valor digitado: R$ ${valorFormatado}`);

  await page.evaluate(() => {
    const input = document.querySelector(
      "#formEmissaoNFConvencional\\:vlrUnitario_input",
    );
    if (input) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const valorNoCampo = await page.evaluate(() => {
    const input = document.querySelector(
      "#formEmissaoNFConvencional\\:vlrUnitario_input",
    );
    return input?.value.trim();
  });

  const esperadoNormalizado = valorFormatado.replace(/\./g, "");
  const campoNormalizado = valorNoCampo.replace(/\./g, "");

  if (campoNormalizado !== esperadoNormalizado) {
    logger.error(
      `❌ Divergência detectada ao digitar valor para ${aluno.ALUNO}: esperado "${valorFormatado}", mas o campo ficou "${valorNoCampo}"`,
    );
    return false;
  }

  return true;
}

export async function clicarAdicionarItem(page) {
  try {
    if (CONFIG.VERBOSE) {
      logger.info("➕ Adicionando item à nota...");
    }

    await page.evaluate(() => {
      const botaoAdicionar = document.querySelector(
        "#formEmissaoNFConvencional\\:btnAddItem",
      );
      if (botaoAdicionar) {
        botaoAdicionar.dispatchEvent(new Event("mouseover", { bubbles: true }));
        botaoAdicionar.dispatchEvent(new Event("mousedown", { bubbles: true }));
        botaoAdicionar.click();
        botaoAdicionar.dispatchEvent(new Event("mouseup", { bubbles: true }));
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const itemAdicionado = await page.evaluate(() => {
      const tabela = document.querySelector(
        "#formEmissaoNFConvencional\\:listaItensNota_data",
      );
      if (!tabela) return false;

      const linhas = tabela.querySelectorAll("tr");
      return linhas.length > 0;
    });

    if (!itemAdicionado) {
      logger.error(
        "❌ O item não foi adicionado à tabela de serviços. Verifique os campos.",
      );
      return false;
    }

    if (CONFIG.VERBOSE) {
      logger.info("✅ Item adicionado com sucesso!");
    }
    return true;
  } catch (error) {
    logger.error(`❌ Erro ao clicar em 'Adicionar Item': ${error.message}`);
    return false;
  }
}

export async function clicarSalvarNota(page) {
  try {
    if (CONFIG.VERBOSE) {
      logger.info("💾 Salvando a nota...");
    }

    await page.waitForSelector("#frmActions\\:btnDefault", { visible: true });

    await page.evaluate(() => {
      let botaoSalvar = document.querySelector("#frmActions\\:btnDefault");
      if (botaoSalvar) {
        botaoSalvar.focus();
        botaoSalvar.dispatchEvent(new Event("mouseover", { bubbles: true }));
        botaoSalvar.dispatchEvent(new Event("mousedown", { bubbles: true }));
        botaoSalvar.click();
        botaoSalvar.dispatchEvent(new Event("mouseup", { bubbles: true }));
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const modalVisivel = await page.evaluate(() => {
      return !!document.querySelector(".ui-confirm-dialog");
    });

    if (!modalVisivel) {
      logger.error(
        "❌ Modal de confirmação não apareceu. Verifique os campos.",
      );
      return false;
    }

    const botaoConfirmar = await page.$("#frmActions\\:j_idt480");

    if (botaoConfirmar) {
      if (CONFIG.SKIP_CONFIRMATION) {
        logger.warn(
          "⚠️  SKIP_CONFIRMATION ativado: o script NÃO confirmará a nota.",
        );
        return false;
      }

      await page.evaluate(() => {
        const botao = document.querySelector("#frmActions\\:j_idt480");
        if (botao) {
          botao.dispatchEvent(new Event("mouseover", { bubbles: true }));
          botao.dispatchEvent(new Event("mousedown", { bubbles: true }));
          botao.click();
          botao.dispatchEvent(new Event("mouseup", { bubbles: true }));
        }
      });

      if (CONFIG.VERBOSE) {
        logger.info("✅ Confirmação realizada, nota salva com sucesso!");
      }
      return true;
    } else {
      logger.error("❌ Botão de confirmação não encontrado!");
      return false;
    }
  } catch (error) {
    logger.error(`❌ Erro ao tentar salvar a nota: ${error.message}`);
    return false;
  }
}
