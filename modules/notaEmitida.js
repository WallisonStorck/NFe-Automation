// notaEmitida.js
import { logger } from "./logger.js";
import { CONFIG } from "../config.js";

export async function registrarInformacoesNota(page) {
  let sucesso = false;

  try {
    if (CONFIG.VERBOSE) {
      logger.info("⏳ Aguardando dados da NFS-e emitida aparecerem na tela...");
    }

    // Aguarda até o painel de dados da nota estar visível e com número preenchido
    await page.waitForFunction(
      () => {
        const container = document.querySelector('[id$=":j_idt1440_content"]');
        if (!container) return false;

        const pegaTextoNode = (label) => {
          const divs = Array.from(container.querySelectorAll(":scope > div"));
          for (const div of divs) {
            const lbl = div.querySelector("label");
            if (lbl && lbl.textContent.trim() === label) {
              return Array.from(div.childNodes)
                .filter((n) => n.nodeType === 3) // TEXT_NODE
                .map((n) => n.textContent.trim())
                .filter((t) => t.length > 0)
                .join("");
            }
          }
          return "";
        };

        const numero = pegaTextoNode("Número:");
        const codigo = pegaTextoNode("Código de Verificação:");
        return numero.length > 0 && codigo.length > 0;
      },
      { timeout: 30000 },
    );

    const dadosNota = await page.evaluate(() => {
      const container = document.querySelector('[id$=":j_idt1440_content"]');

      const pegaTexto = (label) => {
        if (!container) return "Não encontrado";
        const divs = Array.from(container.querySelectorAll(":scope > div"));
        for (const div of divs) {
          const lbl = div.querySelector("label");
          if (lbl && lbl.textContent.trim() === label) {
            // Lê apenas os text nodes diretos do div (exclui o conteúdo do <label>)
            const value = Array.from(div.childNodes)
              .filter((n) => n.nodeType === 3) // Node.TEXT_NODE
              .map((n) => n.textContent.trim())
              .filter((t) => t.length > 0)
              .join("");
            return value || "Não encontrado";
          }
        }
        return "Não encontrado";
      };

      return {
        numero: pegaTexto("Número:"),
        codigoVerificacao: pegaTexto("Código de Verificação:"),
        chaveSeguranca: pegaTexto("Chave de Segurança:"),
        dataEmissao: pegaTexto("Data de Emissão:"),
        horaEmissao: pegaTexto("Hora de Emissão:"),
      };
    });

    if (
      dadosNota.numero !== "Não encontrado" &&
      dadosNota.codigoVerificacao !== "Não encontrado"
    ) {
      logger.info("🧾 Dados da NFS-e emitida:");
      logger.info(`   • Número: ${dadosNota.numero}`);
      logger.info(`   • Código de Verificação: ${dadosNota.codigoVerificacao}`);
      logger.info(`   • Chave de Segurança: ${dadosNota.chaveSeguranca}`);
      logger.info(`   • Data de Emissão: ${dadosNota.dataEmissao}`);
      logger.info(`   • Hora de Emissão: ${dadosNota.horaEmissao}`);
      sucesso = true;
    } else {
      logger.warn("⚠️ Alguns dados da nota não foram encontrados.");
      // ✅ Se chegou aqui, é bem provável que emitiu, mas mudou layout.
    }
  } catch (error) {
    const erroSistema = await page.$(".ui-messages-error, .alert-error");
    if (erroSistema) {
      logger.error(
        "❌ A emissão da nota falhou (erro reportado pelo sistema).",
      );
    } else {
      logger.warn(
        `⚠️ Nenhum dado da NFS-e encontrado, pode ser atraso ou mudança de layout! (${error.message})`,
      );
    }
  }

  // Redirecionar de volta à tela de emissão
  if (!CONFIG.SKIP_CONFIRMATION && !CONFIG.TEST_MODE) {
    try {
      logger.info("↩️ Retornando para a tela de emissão de notas...");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await page.goto(CONFIG.ISS_JARU, { waitUntil: "domcontentloaded" });

      // Usa sentinela estável — o label do dropdown de tipo pessoa
      await page.waitForSelector('[id$=":groupDadosTomador:j_idt533_label"]', {
        visible: true,
        timeout: 10000,
      });

      logger.info("✅ Tela de emissão recarregada com sucesso!");
    } catch (err) {
      if (CONFIG.VERBOSE) {
        logger.warn(
          "⚠️ Não foi possível confirmar visualmente o retorno, mas continuando...",
        );
      }
    }
  } else {
    logger.warn(
      "⏹️ SKIP_CONFIRMATION ativado ou TEST_MODE: mantendo na tela da nota emitida.",
    );
  }

  return sucesso;
}
